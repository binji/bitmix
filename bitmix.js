/*
 * Copyright (C) 2021 Ben Smith
 *
 * This software may be modified and distributed under the terms
 * of the MIT license.  See the LICENSE file for details.
 */
const presets = {
  reverse: [64,'abcdefgh','80200802','884422110','101010101',32,'ff'],
  inter: [64,'abcdefgh','101010101010101','8040201008040201','102040810204081',49,'5555'],
  rinter: [64,'abcdefgh','1001001001001','8084042021010','200040008001',43,'5555'],
  dub4: [32,'abcd','1010101','1020408', '180c0603', 24, 'ff'],
  reverse4: [16,'abcd','111','294','41',7,'f'],
  cabbage: [64,'abcdefgh', '402020201', '8100800408', '41006049', 33, '7f'],
  custom: [16,'abcd','1','ff','1',0,'ff'],
};
const opRow = 0, inputRow = 1, shiftRow = 5;
let currentPreset = 'reverse';
let displayZero = true;

const tableEl = document.querySelector('table');
const selectEl = document.querySelector('#preset');
const opWidthEl = document.querySelector('#opwidth');
const inWidthEl = document.querySelector('#inwidth');
const displayZeroEl = document.querySelector('#zero');
const formulaEl = document.querySelector('#formula');

tableEl.addEventListener('click', event => tableClick(event.target));
selectEl.addEventListener('change', event => loadPreset(event.target.value));
opWidthEl.addEventListener('change', event => opWidthChange(event.target.value));
inWidthEl.addEventListener('change', event => inWidthChange(event.target.value));
displayZeroEl.addEventListener('click', event => zeroClick(event.target));

function addData(tr, text, className, attrs) {
  const td = document.createElement('td');
  td.textContent = text;
  if (className) {
    td.className = className;
  }
  if (attrs && attrs[0] !== undefined) {
    td.setAttribute('data-row', attrs[0]);
    td.setAttribute('data-col', attrs[1]);
  }
  tr.appendChild(td);
}

function getOpWidth() {
  return presets[currentPreset][opRow];
}

function addRow(bits, op, comment, row) {
  const ow = getOpWidth();
  const trEl = document.createElement('tr');
  let className = op ? 'line' : '';
  addData(trEl, op ? op : '', className);
  for (let col = 0; col < ow; col++) {
    let cn = className;
    if ((col % 8) == 7) { cn += ' eight'; }
    else if ((col % 4) == 3) { cn += ' four'; }
    let bit = '';
    if (ow - col <= bits.length) {
      bit = bits[col - ow + bits.length];
      cn += (bit == '0' ? ' zero ' : ' bold');
      if (row !== undefined) { cn += ' edit'; }
    }
    addData(trEl, bit, cn, [row, col]);
  }
  if (comment) {
    addData(trEl, comment, 'edit', [row, -1]);
  }
  tableEl.appendChild(trEl);
}

function toBinary(hex, length) {
  const bits = {
    0:'0000',1:'0001',2:'0010',3:'0011',4:'0100',
    5:'0101',6:'0110',7:'0111',8:'1000',9:'1001',
    'a':'1010','A':'1010','b':'1011','B':'1011',
    'c':'1100','C':'1100','d':'1101','D':'1101',
    'e':'1110','E':'1110','f':'1111','F':'1111',
  };
  let result = '';
  for (let nybble of hex) {
    if (bits.hasOwnProperty(nybble)) {
      result += bits[nybble];
    } else {
      break;
    }
  }
  if (result.length < length) {
    result = '0'.repeat(length - result.length) + result;
  }
  return result;
}

function isEmpty(a) {
  return a == '0' || a == ' ';
}

function mul(a, hexb, row, flatten) {
  const b = toBinary(hexb, getOpWidth());
  addRow(b, '*', `(0x${hexb})`, row);
  let rows = [];
  for (let i = getOpWidth() - 1; i >= 0; --i) {
    if (b[i] != '0') {
      let row = [];
      for (let j = 0; j < getOpWidth(); ++j) {
        row.push((a.length > i - j && j <= i) ? a[j + a.length - 1 - i] : ' ');
      }
      rows.push(row);
    }
  }

  let result = Array.from({length : getOpWidth()}, _ => '0');
  let carry = 0;
  for (let i = getOpWidth() - 1; i >= 0; --i) {
    let dig = carry ? '?' : '0';
    for (let row of rows) {
      if (!isEmpty(row[i])) {
        dig = isEmpty(dig) ? row[i] : '?';
        carry++;
      }
    }
    result[i] = dig;
    carry = Math.floor(carry / 2);
  }

  if (!flatten && rows.length != 1) {
    for (let i = 0; i < rows.length; ++i) {
      addRow(rows[i], i == rows.length - 1 ? '+' : undefined);
    }
  }
  addRow(result);
  return result.join('');
}

function and(a, hexb, row) {
  const b = toBinary(hexb, getOpWidth());
  addRow(b, '&', `(0x${hexb})`, row);

  let result = Array.from({length : getOpWidth()}, _ => '0');
  for (let i = getOpWidth() - 1; i >= 0; --i) {
    result[i] = isEmpty(b[i]) ? '0' : a[i];
  }
  addRow(result);
  return result.join('');
}

function shr(a, amt, idx) {
  addRow('', '>>', `(${amt})`, idx);
  let result = [];
  for (let i = 0; i < getOpWidth(); ++i) {
    result.push(i < amt ? '0' : a[i - amt]);
  }
  addRow(result);
  return result.join('');
}

function loadPreset(value) {
  currentPreset = value;
  opWidthEl.value = presets[value][opRow];
  inWidthEl.value = presets[value][inputRow];
  reload(presets[value]);
}

function stripLeadingZeroes(x) {
  x = x.replace(/^0*/, '');
  return x == '' ? '0' : x;
}

function copyToCustom() {
  if (currentPreset != 'custom') {
    presets.custom = presets[currentPreset].slice();
    currentPreset = 'custom';
    selectEl.value = 'custom';
  }
}

function replaceWithInput(target, row) {
  const prevRow = presets.custom[row];
  const inputEl = document.createElement('input');
  target.replaceWith(inputEl);
  inputEl.value = prevRow;
  inputEl.addEventListener('blur', event => inputEnd(event.target, row));
  inputEl.addEventListener('change', event => inputEnd(event.target, row));
  inputEl.focus();
}

function tableClick(target) {
  if (!target.dataset.row) return;
  copyToCustom();
  const row = target.dataset.row;
  const col = target.dataset.col;
  const prevRow = presets.custom[row];
  if (col == -1) {
    replaceWithInput(target, row);
  } else if (target.textContent != '') {
    const nybbles = getOpWidth() / 4;
    const hexits = Array.from('0'.repeat(nybbles - prevRow.length) + prevRow);
    const num = parseInt(hexits[col>>2], 16);
    hexits[col >> 2] = (num ^ (8 >> (col & 3))).toString(16);
    presets.custom[row] = stripLeadingZeroes(hexits.join(''));
    reload(presets.custom);
  }
}

function validateInput(value, row) {
  // 2 digits (for shift), or N/4 hex-digits (where N is the op width).
  let re = new RegExp((row == shiftRow)
                          ? `(?:0x)?([0-9]{0,2})`
                          : `(?:0x)?([0-9a-fA-F]{0,${getOpWidth() / 4}})`);
  value = re.exec(value)[1];
  return value == '' ? '0' : value;
}

function inputEnd(target, row) {
  presets.custom[row] = validateInput(target.value, row);
  reload(presets.custom);
}

function opWidthChange(value) {
  copyToCustom();
  presets.custom[opRow] = value;
  presets.custom[2] = validateInput(presets.custom[2], 2);
  presets.custom[3] = validateInput(presets.custom[3], 3);
  presets.custom[4] = validateInput(presets.custom[4], 4);
  presets.custom[6] = validateInput(presets.custom[6], 6);
  loadPreset(currentPreset);
}

function inWidthChange(value) {
  copyToCustom();
  presets.custom[inputRow] = value;
  loadPreset(currentPreset);
}

function zeroClick(target) {
  displayZero = !displayZero;
  tableEl.classList.toggle('hide-zero', !displayZero);
}

function inputClick(target) {
  if (!target.dataset.row) return;
  copyToCustom();
  const row = target.dataset.row;
  replaceWithInput(target, row);
}

function appendTextAndSpan(parent, className, text, spanText, row) {
  const textNode = document.createTextNode(text);
  const spanEl = document.createElement('span');
  spanEl.textContent = spanText;
  spanEl.className = className;
  if (row !== undefined) {
    spanEl.dataset.row = row;
  }
  parent.appendChild(textNode);
  parent.appendChild(spanEl);
  spanEl.addEventListener('click', event => inputClick(event.target));
}

function reload(config) {
  setTimeout(() => {
    tableEl.innerHTML = '';
    last = config[1];
    addRow(last);
    last = mul(last, config[2], 2, true);
    last = and(last, config[3], 3);
    last = mul(last, config[4], 4, false);
    last = shr(last, config[5], 5);
    last = and(last, config[6], 6);

    formulaEl.innerHTML = '';
    appendTextAndSpan(formulaEl, 'bold', '((((',     config[1]);
    appendTextAndSpan(formulaEl, 'edit', ' * ',      `0x${config[2]}`,  2);
    appendTextAndSpan(formulaEl, 'edit', ') & ',     `0x${config[3]}`,  3);
    appendTextAndSpan(formulaEl, 'edit', ') * ',     `0x${config[4]}`,  4);
    appendTextAndSpan(formulaEl, 'edit', ') >> ',    config[5],         5);
    appendTextAndSpan(formulaEl, 'edit', ') & ',     `$0x${config[6]}`, 6);
    appendTextAndSpan(formulaEl, 'bold', ' \u279e ', stripLeadingZeroes(last));
  });
}

loadPreset(currentPreset);
