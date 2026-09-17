// Pure, bounded expression grammar. No JavaScript evaluation or property access.
import {isDeepStrictEqual} from 'node:util';
const FUNCTIONS={
 abs:x=>Math.abs(num(x)),floor:x=>Math.floor(num(x)),ceil:x=>Math.ceil(num(x)),round:x=>Math.round(num(x)),sqrt:x=>Math.sqrt(num(x)),
 pow:(x,y)=>Math.pow(num(x),num(y)),min:(...xs)=>Math.min(...numbers(xs)),max:(...xs)=>Math.max(...numbers(xs)),
 sum:xs=>numbers([xs]).reduce((a,b)=>a+b,0),avg:xs=>{const a=numbers([xs]);return a.reduce((x,y)=>x+y,0)/a.length},
 len:x=>{if(typeof x!=='string'&&!Array.isArray(x))throw Error('len erwartet Text oder Array');return typeof x==='string'?[...x].length:x.length},
 clamp:(x,a,b)=>{x=num(x);a=num(a);b=num(b);if(a>b)throw Error('clamp: min > max');return Math.max(a,Math.min(b,x))}
};
function num(x){if(typeof x!=='number'||!Number.isFinite(x))throw Error('Endliche Zahl erforderlich');return x}
function numbers(args){const a=args.length===1&&Array.isArray(args[0])?args[0]:args;if(!a.length)throw Error('Zahlenliste darf nicht leer sein');return a.map(num)}
const arity={abs:1,floor:1,ceil:1,round:1,sqrt:1,pow:2,sum:1,avg:1,len:1,clamp:3};
export function compileExpression(source){
 if(typeof source!=='string'||!source.trim()||source.length>4000)throw Error('Ausdruck benötigt 1–4000 Zeichen');
 const tokens=[];let offset=0;
 while(offset<source.length){if(/\s/.test(source[offset])){offset++;continue}const rest=source.slice(offset),m=/^(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?|^[A-Za-z_][A-Za-z0-9_]*|^"(?:[^"\\]|\\.)*"|^(?:===|!==|==|!=|<=|>=|&&|\|\||\*\*|[+\-*/%<>()!,\[\]])/.exec(rest);if(!m)throw Error('Nicht erlaubtes Zeichen an Position '+(offset+1));tokens.push(m[0]);offset+=m[0].length;if(tokens.length>1000)throw Error('Ausdruck zu komplex')}
 let cursor=0,nodes=0;const prec={'||':1,'&&':2,'==':3,'===':3,'!=':3,'!==':3,'<':4,'<=':4,'>':4,'>=':4,'+':5,'-':5,'*':6,'/':6,'%':6,'**':7};
 const take=expected=>{if(tokens[cursor]!==expected)throw Error('Erwartet: '+expected);cursor++};
 function parse(min=0,depth=0){if(depth>40||++nodes>1000)throw Error('Ausdruck zu tief');let t=tokens[cursor++],left;if(t===undefined)throw Error('Unvollständiger Ausdruck');
 if(t==='('){left=parse(0,depth+1);take(')')}
 else if(t==='['){const values=[];if(tokens[cursor]!==']'){do{values.push(parse(0,depth+1));if(tokens[cursor]!==',')break;cursor++}while(true)}take(']');left={kind:'array',values}}
 else if(['-','+','!'].includes(t))left={kind:'unary',op:t,value:parse(7,depth+1)};
 else if(t.startsWith('"'))left={kind:'value',value:JSON.parse(t)};
 else if(/^(?:\d|\.)/.test(t))left={kind:'value',value:num(Number(t))};
 else if(['true','false','null','pi','e'].includes(t))left={kind:'value',value:({true:true,false:false,null:null,pi:Math.PI,e:Math.E})[t]};
 else if(Object.hasOwn(FUNCTIONS,t)){take('(');const args=[];if(tokens[cursor]!==')'){do{args.push(parse(0,depth+1));if(tokens[cursor]!==',')break;cursor++}while(true)}take(')');if(arity[t]!==undefined&&args.length!==arity[t])throw Error(t+' erwartet '+arity[t]+' Argumente');if(args.length>100)throw Error('Zu viele Argumente');left={kind:'call',name:t,args}}
 else throw Error('Nicht erlaubter Name: '+t);
 while(prec[tokens[cursor]]!==undefined&&prec[tokens[cursor]]>=min){const op=tokens[cursor++],p=prec[op],right=parse(p+(op==='**'?0:1),depth+1);left={kind:'binary',op,left,right}}
 return left}
 const ast=parse();if(cursor!==tokens.length)throw Error('Unerwarteter Ausdrucksteil: '+tokens[cursor]);return ()=>evaluate(ast);
}
function evaluate(n){if(n.kind==='value')return n.value;if(n.kind==='array')return n.values.map(evaluate);if(n.kind==='call'){const result=FUNCTIONS[n.name](...n.args.map(evaluate));if(typeof result==='number')num(result);return result}if(n.kind==='unary'){const x=evaluate(n.value);if(n.op==='!'){if(typeof x!=='boolean')throw Error('! erwartet boolean');return !x}return n.op==='-'?-num(x):num(x)}
 const a=evaluate(n.left);if(n.op==='&&'||n.op==='||'){if(typeof a!=='boolean')throw Error('Logik erwartet boolean');if(n.op==='&&'&&!a)return false;if(n.op==='||'&&a)return true;const b=evaluate(n.right);if(typeof b!=='boolean')throw Error('Logik erwartet boolean');return b}const b=evaluate(n.right);
 if(['==','==='].includes(n.op))return isDeepStrictEqual(a,b);if(['!=','!=='].includes(n.op))return !isDeepStrictEqual(a,b);
 const x=num(a),y=num(b);switch(n.op){case'+':return num(x+y);case'-':return num(x-y);case'*':return num(x*y);case'/':return num(x/y);case'%':return num(x%y);case'**':return num(x**y);case'<':return x<y;case'<=':return x<=y;case'>':return x>y;case'>=':return x>=y;default:throw Error('Operator unbekannt')}
}
export const evaluateExpression=source=>compileExpression(source)();
