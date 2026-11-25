const operationView = document.getElementById('operation-view');
const resultView = document.getElementById('result-view');

let currentInput = '';
let fullOperation = '';
let isCalculated = false;

// Mapeo visual y de cálculo para operadores
const OPERATOR_DISPLAY = {
    '+': '+',
    '-': '−',
    '*': '×',
    '/': '÷'
};

function formatDisplayOperation(opStr) {
    return opStr
        .replace(/\*/g, ' × ')
        .replace(/\//g, ' ÷ ')
        .replace(/\+/g, ' + ')
        .replace(/-/g, ' − ');
}

function updateScreen() {
    resultView.innerText = currentInput || '0';
    operationView.innerText = formatDisplayOperation(fullOperation);
}

function appendNumber(number) {
    if (isCalculated) {
        currentInput = '';
        isCalculated = false;
    }

    if (currentInput === '0' && number === '0') return;
    if (currentInput === '0' && number !== '0') {
        currentInput = number;
    } else {
        currentInput += number;
    }
    updateScreen();
}

function appendDecimal(dot = '.') {
    if (isCalculated) {
        currentInput = '0';
        isCalculated = false;
    }
    if (!currentInput.includes(dot)) {
        if (currentInput === '') currentInput = '0';
        currentInput += dot;
        updateScreen();
    }
}

function appendOperator(op) {
    if (isCalculated) {
        isCalculated = false;
    }

    if (currentInput === '' && fullOperation !== '') {
        // Permite cambiar el operador si el usuario se equivoca
        fullOperation = fullOperation.slice(0, -1) + op;
    } else {
        fullOperation += (currentInput || '0') + op;
        currentInput = '';
    }
    updateScreen();
}

function clearScreen() {
    currentInput = '';
    fullOperation = '';
    isCalculated = false;
    updateScreen();
}

function deleteLast() {
    if (isCalculated) return;
    currentInput = currentInput.toString().slice(0, -1);
    updateScreen();
}

function calculate() {
    if (currentInput === '' && fullOperation === '') return;

    const expression = fullOperation + currentInput;
    try {
        // Comprobar división entre 0
        if (/\/0(?![.\d])/.test(expression)) {
            resultView.innerText = 'Error';
            operationView.innerText = `${formatDisplayOperation(expression)} =`;
            currentInput = '';
            fullOperation = '';
            isCalculated = true;
            return;
        }

        // Evaluar expresión de manera segura
        const result = new Function(`'use strict'; return (${expression})`)();

        if (!isFinite(result) || isNaN(result)) {
            resultView.innerText = 'Error';
            currentInput = '';
            fullOperation = '';
            isCalculated = true;
            return;
        }

        let formattedResult = result;
        // Limitar decimales largos si existen
        if (result % 1 !== 0) {
            formattedResult = parseFloat(result.toFixed(8));
        }

        operationView.innerText = `${formatDisplayOperation(expression)} =`;
        currentInput = formattedResult.toString();
        fullOperation = '';
        isCalculated = true;
        updateScreen();
    } catch (error) {
        resultView.innerText = 'Error';
        currentInput = '';
        fullOperation = '';
        isCalculated = true;
    }
}

// Soporte para entrada por teclado
document.addEventListener('keydown', (event) => {
    const key = event.key;

    if (!isNaN(key)) {
        appendNumber(key);
    } else if (key === '.' || key === ',') {
        appendDecimal('.');
    } else if (key === '+' || key === '-' || key === '*' || key === '/') {
        appendOperator(key);
    } else if (key === 'Enter' || key === '=') {
        event.preventDefault();
        calculate();
    } else if (key === 'Backspace') {
        deleteLast();
    } else if (key === 'Escape' || key.toLowerCase() === 'c') {
        clearScreen();
    }
});
