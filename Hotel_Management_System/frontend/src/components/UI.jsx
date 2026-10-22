import {Plus,ArrowUpRight,ArrowDownRight,MoreHorizontal,CheckCircle2,Clock3,AlertTriangle} from 'lucide-react';
export function PageHead({eyebrow,title,description,action,actionLabel='New'}){
  return <div className="page-head"><div><div className="eyebrow">{eyebrow}</div><h1>{title}</h1>{description&&<p>{description}</p>}</div>{action&&<button type="button" className="btn primary" onClick={() => { if (typeof action === 'function') action(); }}><Plus size={17}/>{actionLabel}</button>}</div>;
}
export function StatCard({label,value,change,positive=true,icon:Icon}){return <div className="stat-card"><div className="stat-top"><span>{label}</span>{Icon&&<div className="stat-icon"><Icon size={18}/></div>}</div><strong>{value}</strong>{change&&<div className={positive?'trend up':'trend down'}>{positive?<ArrowUpRight size={14}/>:<ArrowDownRight size={14}/>} {change}</div>}</div>}
export function Status({children}){let c=String(children).toLowerCase().replaceAll(' ','-');return <span className={`status ${c}`}>{children}</span>}
export function EmptyState({title='Nothing here yet',text='Create your first record to get started.'}){return <div className="empty"><div className="empty-icon">◈</div><h3>{title}</h3><p>{text}</p></div>}
export function Table({columns,rows}){return <div className="table-wrap"><table><thead><tr>{columns.map(c=><th key={c}>{c}</th>)}</tr></thead><tbody>{rows}</tbody></table></div>}
export const IconButton=({children})=><button className="icon-btn subtle">{children||<MoreHorizontal size={18}/>}</button>;
export function Toolbar({children}){return <div className="toolbar"><div className="filter-search"><span>⌕</span><input placeholder="Search..."/></div><div className="toolbar-actions">{children}</div></div>}
export const ActionButton=({children})=><button className="btn secondary">{children}</button>;
export function Progress({value}){return <div className="progress"><span style={{width:`${value}%`}}/></div>}
export const Notice=({type='info',children})=><div className={`notice ${type}`}>{type==='success'?<CheckCircle2/>:type==='warning'?<AlertTriangle/>:<Clock3/>}<span>{children}</span></div>;
