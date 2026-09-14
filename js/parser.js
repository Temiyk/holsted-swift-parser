const textarea = document.getElementById("code")
const sendBtn = document.getElementById("sendBtn")

let content = "";

const KEYWORDS = ['if','else','switch','case','default','guard','return',
    'for','in','while','repeat','continue','break','print'];

const IGNORE = ['let','var','func','import','Foundation',
    'Int','String','Bool','Double','Float','Character','true','false'];

const MULTI_OPS = ['<<=','>>=','...','..<','==','!=','<=','>=','&&','||',
    '+=','-=','*=','/=','%=','&=','|=','^=','<<','>>','->'];

sendBtn.addEventListener('click', (e) => {
   content = textarea.value;
   if (!content.trim()) {
       alert("Введите код программы");
       return;
   }

   const clean = content.split('\n')
       .map(line => line.split('//')[0])
       .join('\n');

   const tokens = [];
   let buf = '';
   let mode = '';

   const isLetter = c => (c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z') || c === '_';
   const isDigit  = c => c >= '0' && c <= '9';
   const isSpace  = c => c === ' ' || c === '\t' || c === '\n' || c === '\r';

   const flush = () => {
       if (buf) {
           tokens.push(buf); buf = '';
       }
       mode = '';
   };

   for (const c of clean) {
       if (mode === 'str') {
           buf += c;
           if (c === '"' && buf.length > 1) flush();
           continue;
       }
       if (isSpace(c)) { flush(); continue; }

       if (mode === 'word' && isLetter(c)) { buf += c; continue; }
       if (mode === 'word' && isDigit(c))  { buf += c; continue; }
       if (mode === 'num' && (isDigit(c) || c === '.')) { buf += c; continue; }
       if (mode === 'op' && !isLetter(c) && !isDigit(c)) { buf += c; continue; }

       flush();
       buf = c;
       if (isLetter(c)) mode = 'word';
       else if (isDigit(c)) mode = 'num';
       else if (c === '"') mode = 'str';
       else mode = 'op';
   }
   flush();

   const ops = [];
   for (let i = 0; i < tokens.length; i++) {
       let matched = null;
       for (const m of MULTI_OPS) {
           if (tokens.slice(i, i + m.length).join('') === m) {
               matched = m;
               break;
           }
       }
       if (matched) {
           ops.push(matched);
           i += matched.length - 1;
       }
       else ops.push(tokens[i]);
   }

   const operators = new Map();
   const operands = new Map();
   const add = (map, key) => map.set(key, (map.get(key) || 0) + 1);

   for (const t of ops) {
       if (isLetter(t[0])) {
           if (IGNORE.includes(t)) continue;
           if (KEYWORDS.includes(t)) add(operators, t);
           else add(operands, t);
       } else if (isDigit(t[0]) || t[0] === '"') {
           add(operands, t);
       } else {
           add(operators, (t === '(' || t === ')') ? '( )' : t);
       }
   }
   operators.delete(')');

   const table = document.getElementById('result');
   table.querySelectorAll('tr:not(:first-child)').forEach(r => r.remove());

   const L = [...operators.entries()];
   const R = [...operands.entries()];
   const n = Math.max(L.length, R.length);

   for (let i = 0; i < n; i++) {
       const l = L[i] || ['', ''];
       const r = R[i] || ['', ''];
       const tr = document.createElement('tr');
       tr.innerHTML = `<td>${l[0] ? i + 1 : ''}</td><td>${l[0]}</td><td>${l[1]}</td>
                    <td>${r[0] ? i + 1 : ''}</td><td>${r[0]}</td><td>${r[1]}</td>`;
       table.appendChild(tr);
   }

   const sum = arr => arr.reduce((a, [, v]) => a + v, 0);
   const totalTr = document.createElement('tr');
   totalTr.innerHTML = `<td></td><td>η1 = ${operators.size}</td><td>N1 = ${sum(L)}</td>
                     <td></td><td>η2 = ${operands.size}</td><td>N2 = ${sum(R)}</td>`;
   table.appendChild(totalTr);

   document.querySelector('.container-result').style.display = 'block';
});



