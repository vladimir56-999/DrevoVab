const GOOGLE_SHEETS_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vT1t2HYNkqo-_cOu7_nx9sC-0ibmDevy_FmvwK_sjTyf8zfdYCKtuV3v6mOHlf7jrb5PGerj55g0KMt/pub?output=csv';

async function fetchData() {
  const loadingEl = document.getElementById('loading');
  if (loadingEl) {
    loadingEl.style.display = 'block';
    loadingEl.textContent = 'Загрузка данных…';
  }

  try {
    const response = await fetch(GOOGLE_SHEETS_URL);
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    const text = await response.text();
    const data = parseCSV(text);
    buildTree(data);
  } catch (error) {
    console.error('Ошибка загрузки данных:', error);
    if (loadingEl) {
      loadingEl.textContent = 'Ошибка загрузки. Проверьте подключение.';
    }
  }
}

function parseCSV(csvText) {
  const lines = csvText.trim().split('\n');
  if (lines.length < 2) return [];

  const headers = lines[0].split(',').map(h => h.trim());
  return lines.slice(1).map(line => {
    const values = line.split(',');
    const person = {};
    headers.forEach((header, index) => {
      person[header] = (values[index] || '').trim();
    });
    return person;
  });
}

function buildTree(data) {
  const container = document.getElementById('tree-container');
  const loadingEl = document.getElementById('loading');

  if (!container) {
    console.error('Элемент #tree-container не найден');
    return;
  }

  container.innerHTML = '';
  if (loadingEl) loadingEl.style.display = 'none';

  const validData = data.filter(person => person.ID && person.ID.trim() !== '');

  if (validData.length === 0) {
    container.innerHTML = '<p>Нет данных.</p>';
    return;
  }

  const generations = {};
  validData.forEach(person => {
    const gen = (person['Поколение'] || '1').trim() || '1';
    if (!generations[gen]) generations[gen] = [];
    generations[gen].push(person);
  });

  const sortedGens = Object.keys(generations).sort((a, b) => Number(a) - Number(b));

  sortedGens.forEach(genKey => {
    const wrapper = document.createElement('div');
    wrapper.className = 'generation-wrapper';

    const genDiv = document.createElement('div');
    genDiv.className = 'generation';
    genDiv.dataset.generation = genKey;

    const label = document.createElement('div');
    label.className = 'gen-label';
    label.textContent = `Поколение ${genKey}`;
    genDiv.appendChild(label);

    generations[genKey].forEach(person => {
      const personDiv = createPersonCard(person);
      genDiv.appendChild(personDiv);
    });

    wrapper.appendChild(genDiv);
    container.appendChild(wrapper);
  });

  setTimeout(() => drawConnections(validData, container), 150);
}

function createPersonCard(person) {
  const div = document.createElement('div');
  div.className = 'person';
  div.id = `person-${person['ID']}`;

  const img = document.createElement('img');
  img.src = person['Фото URL'] || 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100"%3E%3Crect fill="%23eee" width="100" height="100"/%3E%3Ctext x="50" y="55" text-anchor="middle" font-size="12" fill="%23999"%3EНет фото%3C/text%3E%3C/svg%3E';
  img.alt = person['Имя'] || '—';
  img.className = 'person-image';

  const nameDiv = document.createElement('div');
  nameDiv.className = 'person-name';
  nameDiv.textContent = person['Имя'] || '—';

  // Tooltip с полным именем
  const tooltip = document.createElement('div');
  tooltip.className = 'person-name-tooltip';
  tooltip.textContent = person['Имя'] || '—';
  nameDiv.appendChild(tooltip);

  const datesDiv = document.createElement('div');
  datesDiv.className = 'person-dates';
  const birth = person['Дата рождения'] || '?';
  const death = person['Дата смерти'] ? person['Дата смерти'] : 'н.в.';
  datesDiv.textContent = `${birth} – ${death}`;

  const infoDiv = document.createElement('div');
  infoDiv.className = 'person-info';
  infoDiv.appendChild(nameDiv);
  infoDiv.appendChild(datesDiv);

  div.appendChild(img);
  div.appendChild(infoDiv);
  return div;
}

function drawLine(svg, from, to) {
  const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
  line.setAttribute('x1', from.x);
  line.setAttribute('y1', from.y);
  line.setAttribute('x2', to.x);
  line.setAttribute('y2', to.y);
  line.setAttribute('stroke', '#3498db');
  line.setAttribute('stroke-width', '1.4');
  line.setAttribute('stroke-opacity', '0.85');
  svg.appendChild(line);
}

function drawSpouseLine(svg, from, to) {
  const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
  line.setAttribute('x1', from.x);
  line.setAttribute('y1', from.y);
  line.setAttribute('x2', to.x);
  line.setAttribute('y2', to.y);
  line.setAttribute('stroke', '#e74c3c');
  line.setAttribute('stroke-width', '2');
  line.setAttribute('stroke-opacity', '0.9');
  line.setAttribute('stroke-dasharray', '4,2');
  svg.appendChild(line);
}

function drawConnections(data, container) {
  const existingSvg = container.querySelector('svg');
  if (existingSvg) existingSvg.remove();

  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  Object.assign(svg.style, {
    position: 'absolute',
    top: '0',
    left: '0',
    width: '100%',
    height: '100%',
    pointerEvents: 'none',
    zIndex: '-1'
  });
  container.appendChild(svg);

  const positions = new Map();
  const persons = container.querySelectorAll('.person');
  persons.forEach(person => {
    const rect = person.getBoundingClientRect();
    const containerRect = container.getBoundingClientRect();
    positions.set(person.id, {
      x: rect.left - containerRect.left + rect.width / 2,
      y: rect.top - containerRect.top + rect.height / 2
    });
  });

  // Родительские связи
  data.forEach(person => {
    if (!person.ID) return;
    const childId = `person-${person['ID']}`;
    const childPos = positions.get(childId);
    if (!childPos) return;

    if (person['Отец ID']) {
      const fatherId = `person-${person['Отец ID']}`;
      const fatherPos = positions.get(fatherId);
      if (fatherPos) drawLine(svg, fatherPos, childPos);
    }
    if (person['Мать ID']) {
      const motherId = `person-${person['Мать ID']}`;
      const motherPos = positions.get(motherId);
      if (motherPos) drawLine(svg, motherPos, childPos);
    }
  });

  // Супружеские связи
  data.forEach(person => {
    if (!person.ID || !person['Супруг ID']) return;
    const personId = `person-${person['ID']}`;
    const spouseId = `person-${person['Супруг ID']}`;
    const personPos = positions.get(personId);
    const spousePos = positions.get(spouseId);
    if (personPos && spousePos && person['ID'] < person['Супруг ID']) {
      drawSpouseLine(svg, personPos, spousePos);
    }
  });
}

document.addEventListener('DOMContentLoaded', () => {
  fetchData();
});


