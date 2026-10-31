import {jsPDF} from 'jspdf';
import * as src from '../legacy/reporting.mjs';
import type {FinanceData} from './types';
import {brl,fmtDate} from './finance';
export const monthlyReport=src.monthlyReport as (data:FinanceData,month:string)=>{month:string;summary:{income:number;expense:number;net:number;toPay:number;toReceive:number;count:number;consolidatedCents:number};categories:{name:string;cents:number;share:number}[];transactions:{description:string;amountCents:number;date:string;category:string;status:string;kind:string}[];accounts:{name:string;balanceCents:number}[]};
export const annualReport=src.annualReport as (data:FinanceData,year:string)=>{year:string;months:{month:string;income:number;expense:number;net:number;toPay:number}[];income:number;expense:number;net:number};
export const monthlyReportCSV=src.monthlyReportCSV as (data:FinanceData,month:string)=>string;
export const annualReportCSV=src.annualReportCSV as (data:FinanceData,year:string)=>string;
export function exportReportPDF(data:FinanceData,month:string){
 const r=monthlyReport(data,month);
 const doc=new jsPDF({unit:'mm',format:'a4'});
 doc.setProperties({title:`Clara Finanças - ${month}`,subject:'Relatório financeiro local'});
 let y=18;
 const line=(text:string,{bold=false,size=10,space=7}:{bold?:boolean;size?:number;space?:number}={})=>{
  doc.setFont('helvetica',bold?'bold':'normal');doc.setFontSize(size);
  const lines=doc.splitTextToSize(text,172) as string[];
  if(y+lines.length*space>278){doc.addPage();y=18;}
  doc.text(lines,19,y);y+=lines.length*space;
 };
 line('CLARA FINANCAS | RELATORIO', {bold:true,size:17,space:9});
 line('Periodo: '+month,{bold:true,size:11});
 line('Receitas realizadas: '+brl(r.summary.income));
 line('Despesas realizadas: '+brl(r.summary.expense));
 line('Resultado: '+brl(r.summary.net),{bold:true});
 line('A pagar: '+brl(r.summary.toPay)+' | A receber: '+brl(r.summary.toReceive));
 y+=4;line('DESPESAS POR CATEGORIA',{bold:true,size:12});
 if(!r.categories.length)line('Nenhuma despesa realizada no periodo.');
 for(const c of r.categories)line(c.name+': '+brl(c.cents)+' ('+(c.share*100).toFixed(1)+'%)');
 y+=4;line('MOVIMENTACOES DO PERIODO',{bold:true,size:12});
 for(const t of r.transactions){
  line(fmtDate(t.date)+' | '+t.description+' | '+t.kind+' | '+brl(t.amountCents)+' | '+t.status,{size:9,space:5});
 }
 if(r.transactions.length===0)line('Nenhuma movimentacao neste periodo.');
 doc.setFontSize(8);doc.setTextColor(105,114,126);
 doc.text('Gerado localmente no Clara Financas. Valores em BRL. Revise antes de compartilhar.',19,288);
 doc.save(`clara-relatorio-${month}.pdf`);
}
