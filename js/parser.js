const textarea = document.getElementById("code");
const sendBtn = document.getElementById("sendBtn");

let content = "";

const KEYWORDS = ['if','switch','guard','return',
    'for','in','while','repeat','continue','break','print'];

const IGNORE = ['let','var','func','import','Foundation',
    'Int','String','Bool','Double','Float','Character','_'];

// Приоритет отдан диапазонам
const MULTI_OPS = ['...','..<','<<=','>>=','==','!=','<=','>=','&&','||',
    '+=','-=','*=','/=','%=','&=','|=','^=','<<','>>','->'];

sendBtn.addEventListener('click', (e) => {
    content = textarea.value;
    if (!content.trim()) {
        alert("Введите код программы");
        return;
    }

    // Удаление комментариев до символа //
    const clean = content.split('\n')
        .map(line => line.split('//')[0])
        .join('\n');

    const isLetter = c => (c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z') || c === '_';
    const isDigit  = c => c >= '0' && c <= '9';
    const isSpace  = c => c === ' ' || c === '\t' || c === '\n' || c === '\r';

    function tokenize(src) {
        const tokens = [];
        const n = src.length;
        let i = 0;

        while (i < n) {
            const c = src[i];

            if (c === '"') {
                let j = i + 1;
                while (j < n) {
                    if (src[j] === '\\') { j += 2; continue; }
                    if (src[j] === '"')  { j++; break; }
                    j++;
                }
                tokens.push(src.slice(i, j));
                i = j;
                continue;
            }
            if (isSpace(c)) { i++; continue; }

            if (isLetter(c)) {
                let j = i + 1;
                while (j < n && (isLetter(src[j]) || isDigit(src[j]))) j++;
                tokens.push(src.slice(i, j));
                i = j;
                continue;
            }

            // ИСПРАВЛЕНО: Полностью переписан алгоритм разбора чисел во избежание конфликта с диапазонами
            if (isDigit(c)) {
                let j = i + 1;
                while (j < n && isDigit(src[j])) j++;
                
                // Если дальше идёт точка, но за ней ещё одна точка (например, 1... или 0..<) -> это диапазон! Stop.
                if (j < n && src[j] === '.' && j + 1 < n && src[j + 1] === '.') {
                    // Не трогаем точку, это часть диапазона
                } else if (j < n && src[j] === '.' && j + 1 < n && isDigit(src[j + 1])) {
                    // Это обычное дробное число (например, 3.14) -> считываем дальше
                    j++;
                    while (j < n && isDigit(src[j])) j++;
                }
                
                tokens.push(src.slice(i, j));
                i = j;
                continue;
            }

            let matched = null;
            for (const m of MULTI_OPS) {
                if (src.startsWith(m, i)) { matched = m; break; }
            }
            if (matched) {
                tokens.push(matched);
                i += matched.length;
                continue;
            }

            tokens.push(c);
            i++;
        }
        return tokens;
    }

    const rawTokens = tokenize(clean);

    const tokens = [];
    for (const tok of rawTokens) {
        tokens.push(tok);
        if (tok && tok[0] === '"') { 
            let i = 0;
            while (i < tok.length) {
                if (tok[i] === '\\' && tok[i + 1] === '(') {
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

    const functionNames = new Set();
    for (let i = 0; i < tokens.length; i++) {
        const t = tokens[i];
        if (!t || !isLetter(t[0])) continue; 
        if (tokens[i + 1] === '(')   functionNames.add(t); 
        if (tokens[i - 1] === 'func') functionNames.add(t); 
    }

    const operators = new Map();
    const operands  = new Map();
    const add = (map, key) => map.set(key, (map.get(key) || 0) + 1);

    const controlStack = [];

    for (let i = 0; i < tokens.length; i++) {
        const t = tokens[i];
        if (!t) continue;
        const prev = tokens[i - 1];
        const next = tokens[i + 1];

        if (t[0] === '"')  { add(operands, t); continue; } 
        if (isDigit(t[0])) { add(operands, t); continue; } 

        if (isLetter(t[0])) { 
            if (next === ':' &&
                (prev === '(' || prev === ',' || prev === '_' || prev === undefined)) {
                continue;
            }
            if (IGNORE.includes(t)) continue;

            if (t === 'if') {
                controlStack.push('if-else');
                add(operators, 'if-else');
                continue;
            }
            if (t === 'switch') {
                controlStack.push('switch-case-default');
                add(operators, 'switch-case-default');
                continue;
            }
            if (t === 'guard') {
                controlStack.push('guard-else');
                add(operators, 'guard-else');
                continue;
            }

            if (t === 'else') {
                const context = controlStack.filter(c => c === 'if-else' || c === 'guard-else').pop() || 'if-else';
                add(operators, context);
                continue;
            }
            if (t === 'case' || t === 'default') {
                add(operators, 'switch-case-default');
                continue;
            }

            if (functionNames.has(t) || KEYWORDS.includes(t)) add(operators, t);
            else add(operands, t);
            continue;
        }

        if (t === '(') {
            if (prev && (functionNames.has(prev) || KEYWORDS.includes(prev) || prev === 'if' || prev === 'switch' || prev === 'guard')) continue;
            add(operators, '( )');
            continue;
        }
        if (t === ')') continue;
        if (t === '{') { 
            controlStack.push('{'); 
            add(operators, '{ }'); 
            continue; 
        }
        if (t === '}') {
            if (controlStack.length > 0) {
                if (controlStack[controlStack.length - 1] === '{') controlStack.pop();
                if (controlStack.length > 0 && controlStack[controlStack.length - 1] !== '{') controlStack.pop();
            }
            continue; 
        }
        if (t === '[') { add(operators, '[ ]'); continue; }
        if (t === ']') continue;
        if (t === ',') continue;

        // ИСПРАВЛЕНО: Прямая регистрация диапазонов как операторов
        if (t === '...' || t === '..<') {
            add(operators, t);
            continue;
        }

        if (t === '?') {
            add(operators, '? :');
            continue;
        }
        if (t === ':') {
            let isTernary = false;
            for (let k = i - 1; k >= 0; k--) {
                if (tokens[k] === ';') break;
                if (tokens[k] === '?') { isTernary = true; break; }
            }
            if (isTernary) {
                add(operators, '? :');
            }
            continue;
        }

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

    const eta1= operators.size, N1 = sum(L);
    const eta2= operands.size,  N2 = sum(R);
    const eta = eta1 + eta2;
    const N = N1 + N2;
    const V = Math.trunc(N * Math.log2(eta));

    const totalTr = document.createElement('tr');
    totalTr.innerHTML = `<td></td><td>η1 = ${operators.size}</td><td>N1 = ${sum(L)}</td>
                     <td></td><td>η2 = ${operands.size}</td><td>N2 = ${sum(R)}</td>`;
    table.appendChild(totalTr);

    document.querySelector('.container-result').style.display = 'block';

    let additional = document.getElementById('metrics-summary');
    if (!additional) {
        additional = document.createElement('p');
        additional.id = 'metrics-summary';
        document.querySelector('.container-result').appendChild(additional);
    }
    additional.innerHTML = `Словарь программы η = ${eta}<br>Длина программы N = ${N}<br>Объём программы V = ${V}`;

});
