"""Etapa 1: invariantes financeiros, validação hostil e integridade do cofre.

Executar contra dist/ no Chromium com dados exclusivamente fictícios.
"""
import asyncio
from playwright.async_api import async_playwright

BASE = "http://127.0.0.1:8765/"
PASSWORD = "Clara-Etapa1-QA-2026!"


async def unlock(page):
    await page.goto(BASE, wait_until="load")
    assert await page.locator("#securityCover").is_visible()
    await page.locator("#securityPassword").fill(PASSWORD)
    if await page.locator("#securityConfirmWrap").is_visible():
        await page.locator("#securityConfirm").fill(PASSWORD)
    await page.locator("#securitySubmit").click()
    await page.wait_for_function(
        "window.ClaraSecurity?.unlocked === true", timeout=30000
    )


async def main():
    async with async_playwright() as playwright:
        browser = await playwright.chromium.launch(headless=True)
        context = await browser.new_context(
            viewport={"width": 390, "height": 844},
            timezone_id="America/Sao_Paulo",
        )
        page = await context.new_page()
        errors = []
        page.on("pageerror", lambda error: errors.append(str(error)))
        try:
            await unlock(page)
            baseline = await page.evaluate("""async () => {
                const date = todayISO();
                state.accounts[0].openingCents = 100000;
                state.accounts.push({
                    id: 'etapa1-reserva', name: 'Reserva de teste',
                    type: 'Reserva', openingCents: 20000
                });
                const make = (id, kind, amountCents, accountId, status,
                              toAccountId = '') => ({
                    id, kind, amountCents, accountId, toAccountId, status,
                    description: 'Etapa 1 ' + id,
                    category: kind === 'Receita' ? 'Salário'
                      : kind === 'Despesa' ? 'Moradia' : '',
                    date, paidAt: status === 'Realizado' ? date : ''
                });
                state.transactions = [
                    make('et1-r', 'Receita', 50000, 'principal', 'Realizado'),
                    make('et1-d', 'Despesa', 12500, 'principal', 'Realizado'),
                    make('et1-t', 'Transferência', 8000, 'principal',
                         'Realizado', 'etapa1-reserva'),
                    make('et1-p', 'Despesa', 5000, 'principal', 'Pendente'),
                    make('et1-a', 'Receita', 3000, 'principal', 'Pendente'),
                    make('et1-c', 'Despesa', 9000, 'principal', 'Cancelado')
                ];
                state.settings.period = date.slice(0, 7);
                state.settings.cutoff = date;
                save();
                await window.ClaraSecurity.flush();
                const s = stat(date.slice(0, 7));
                return {
                    principal: accountBalance('principal', date),
                    reserva: accountBalance('etapa1-reserva', date),
                    total: totalBalance(date),
                    income: s.income, expense: s.expense,
                    toPay: s.toPay, toReceive: s.toReceive,
                    transferTotal: signed(state.transactions[2], 'principal') +
                      signed(state.transactions[2], 'etapa1-reserva')
                };
            }""")
            assert baseline == {
                "principal": 129500, "reserva": 28000, "total": 157500,
                "income": 50000, "expense": 12500, "toPay": 5000,
                "toReceive": 3000, "transferTotal": 0,
            }, baseline

            invalid = await page.evaluate("""() => {
                const cases = {
                    'duplicated-transaction': data => {
                        data.transactions.push(structuredClone(data.transactions[0]));
                    },
                    'duplicated-account': data => {
                        data.accounts.push(structuredClone(data.accounts[0]));
                    },
                    'fractional-cents': data => {
                        data.transactions[0].amountCents = 0.5;
                    },
                    'non-finite-cents': data => {
                        data.transactions[0].amountCents = Infinity;
                    },
                    'negative-transaction': data => {
                        data.transactions[0].amountCents = -1;
                    },
                    'unknown-account': data => {
                        data.transactions[0].accountId = 'unknown';
                    },
                    'transfer-to-self': data => {
                        data.transactions[2].toAccountId = 'principal';
                    },
                    'wrong-category': data => {
                        data.transactions[0].category = 'Moradia';
                    },
                    'invalid-date': data => {
                        data.transactions[0].date = '2026-99-99';
                    },
                    'duplicate-reconciliation': data => {
                        data.reconciliations = [
                            {id: 'rec1', accountId: 'principal',
                             date: todayISO(), statementCents: 10000},
                            {id: 'rec2', accountId: 'principal',
                             date: todayISO(), statementCents: 10000}
                        ];
                    }
                };
                return Object.fromEntries(Object.entries(cases).map(([name, mutate]) => {
                    const copy = structuredClone(state);
                    mutate(copy);
                    try {
                        validateData(copy);
                        return [name, false];
                    } catch {
                        return [name, true];
                    }
                }));
            }""")
            assert all(invalid.values()), f"Importação inválida aceita: {invalid}"

            recovery = await page.evaluate("""async password => {
                const originalVault = localStorage.getItem(
                    'clara-financas-vault-aesgcm-v1');
                const originalState = JSON.stringify(state);
                const vault = validateVault(originalVault);
                const key = await deriveKey(password, b64Bytes(vault.salt));
                const decrypted = await decryptState(vault, key);
                const roundTrip = JSON.stringify(decrypted) === originalState;
                const ciphertextPrivate =
                    !originalVault.includes('Etapa 1 et1-r') &&
                    !originalVault.includes('Reserva de teste');
                let wrongPasswordRejected = false;
                try {
                    await window.ClaraSecurity.restoreLocalEncrypted(
                        originalVault, 'senha-incorreta-para-qa');
                } catch {
                    wrongPasswordRejected = true;
                }
                const damaged = {...vault};
                damaged.data = (vault.data[0] === 'A' ? 'B' : 'A') +
                    vault.data.slice(1);
                let tamperingRejected = false;
                try {
                    await window.ClaraSecurity.restoreLocalEncrypted(
                        JSON.stringify(damaged), password);
                } catch {
                    tamperingRejected = true;
                }
                return {
                    roundTrip, ciphertextPrivate, wrongPasswordRejected,
                    tamperingRejected,
                    stateUntouched: JSON.stringify(state) === originalState,
                    vaultUntouched: localStorage.getItem(
                        'clara-financas-vault-aesgcm-v1') === originalVault
                };
            }""", PASSWORD)
            assert all(recovery.values()), recovery

            await page.evaluate("window.ClaraSecurity.lock()")
            assert await page.locator("#securityCover").is_visible()
            assert not await page.evaluate("window.ClaraSecurity.unlocked")
            await page.locator("#securityPassword").fill(PASSWORD)
            await page.locator("#securitySubmit").click()
            await page.wait_for_function(
                "window.ClaraSecurity.unlocked", timeout=30000
            )
            after_lock = await page.evaluate("""() => ({
                total: totalBalance(todayISO()),
                count: state.transactions.length,
                encrypted: !localStorage.getItem(
                    'clara-financas-vault-aesgcm-v1').includes('Etapa 1 et1-r')
            })""")
            assert after_lock == {
                "total": 157500, "count": 6, "encrypted": True,
            }, after_lock
            assert not errors, errors
            print(
                "ETAPA 1 OK: centavos, 10 importações inválidas, "
                "cofre cifrado, adulteração, senha incorreta e bloqueio."
            )
        finally:
            await context.close()
            await browser.close()


asyncio.run(main())
