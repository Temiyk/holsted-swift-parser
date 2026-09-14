const textarea = document.getElementById("code");
const sendBtn = document.getElementById("sendBtn");

let content = "";

const KEYWORDS = ['if','else','switch','case','default','guard','return',
    'for','in','while','repeat','continue','break','print'];

const IGNORE = ['let','var','func','import','Foundation',
    'Int','String','Bool','Double','Float','Character','_'];

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

    const isLetter = c => (c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z') || c === '_';
    const isDigit  = c => c >= '0' && c <= '9';
    const isSpace  = c => c === ' ' || c === '\t' || c === '\n' || c === '\r';

    // ---- Токенизация: синтаксис сохранён, добавлена только ветка для '"' ----
    function tokenize(src) {
        const tokens = [];
        let buf = '';
        let mode = '';

        const flush = () => {
            if (buf) { tokens.push(buf); buf = ''; }
            mode = '';
        };

        for (const c of src) {
            if (mode === 'str') {
                buf += c;
                if (c === '"' && buf.length > 1) flush();
                continue;
            }
            // ЕДИНСТВЕННОЕ ДОБАВЛЕНИЕ: '"' всегда открывает строку
            if (c === '"') {
                flush();
                buf = '"';
                mode = 'str';
                continue;
            }
            if (isSpace(c)) { flush(); continue; }

            if (mode === 'word' && isLetter(c)) { buf += c; continue; }
            if (mode === 'word' && isDigit(c))  { buf += c; continue; }
            if (mode === 'num'  && (isDigit(c) || c === '.')) { buf += c; continue; }
            if (mode === 'op'   && !isLetter(c) && !isDigit(c)) { buf += c; continue; }

            flush();
            buf = c;
            if (isLetter(c)) mode = 'word';
            else if (isDigit(c)) mode = 'num';
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
            if (matched) { ops.push(matched); i += matched.length - 1; }
            else ops.push(tokens[i]);
        }
        return ops;
    }

    const rawTokens = tokenize(clean);

    // ---- Разворачиваем интерполяции \( ... ) внутри строк ----
    const tokens = [];
    for (const tok of rawTokens) {
        tokens.push(tok);
        if (tok[0] === '"') {
            let i = 0;
            while (i < tok.length) {
                if (tok[i] === '\\' && tok[i+1] === '(') {
                    let depth = 1;
                    let j = i + 2;
                    while (j < tok.length && depth > 0) {
                        if (tok[j] === '(') depth++;
                        else if (tok[j] === ')') depth--;
                        if (depth > 0) j++;
                    }
                    const expr = tok.slice(i + 2, j);
                    if (expr.trim()) tokens.push(...tokenize(expr));
                    i = j + 1;
                } else {
                    i++;
                }
            }
        }
    }

    // ---- Имена функций/процедур/методов (по Холстеду — это операторы) ----
    const functionNames = new Set();
    for (let i = 0; i < tokens.length; i++) {
        const t = tokens[i];
        if (!t || !isLetter(t[0])) continue;
        if (tokens[i+1] === '(')  functionNames.add(t);   // вызов
        if (tokens[i-1] === 'func') functionNames.add(t); // объявление
    }

    // ---- Классификация ----
    const operators = new Map();
    const operands  = new Map();
    const add = (map, key) => map.set(key, (map.get(key) || 0) + 1);

    for (let i = 0; i < tokens.length; i++) {
        const t = tokens[i];
        if (!t) continue;
        const prev = tokens[i-1];
        const next = tokens[i+1];

        // строковые литералы — операнды
        if (t[0] === '"')       { add(operands, t); continue; }
        // числовые литералы — операнды
        if (isDigit(t[0]))      { add(operands, t); continue; }

        // идентификаторы
        if (isLetter(t[0])) {
            // аргументные метки и имена параметров (a:, b:, separator:, num:)
            if (next === ':' &&
                (prev === '(' || prev === ',' || prev === '_' || prev === undefined)) {
                continue;
            }
            // Int, String, let, var и т.д. — вообще не считаем
            if (IGNORE.includes(t)) continue;
            // имена функций и ключевые слова — операторы
            if (functionNames.has(t) || KEYWORDS.includes(t)) add(operators, t);
            else add(operands, t);
            continue;
        }

        if (t === '(') {
            if (prev && (functionNames.has(prev) || KEYWORDS.includes(prev))) continue;
            add(operators, '( )');
            continue;
        }
        if (t === ')') continue;
        if (t === '{') { add(operators, '{ }'); continue; }
        if (t === '}') continue;
        if (t === '[') { add(operators, '[ ]'); continue; }
        if (t === ']') continue;
        if (t === ',') continue;
        if (t === ':') continue;

        add(operators, t);
    }

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