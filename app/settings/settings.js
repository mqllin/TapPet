'use strict';

const api = window.desktopPet;
const form = document.querySelector('#preferences');
const message = document.querySelector('#message');
const sizeLabel = document.querySelector('#size-label');
const fields = Array.from(form.elements).filter(field => field.name);

function report(text) {
  message.textContent = text || '';
  message.hidden = !text;
}

function showStatus(status) {
  const labels = {active: '键鼠联动中', paused: '键鼠联动已暂停', permission: '需要辅助功能权限', error: '键鼠联动不可用'};
  document.querySelector('#input-status').textContent = labels[status] || '';
  document.querySelector('#permission').hidden = status !== 'permission';
}

function render({settings, inputStatus, warning}) {
  for (const field of fields) {
    if (field.type === 'checkbox') field.checked = settings[field.name];
    else field.value = field.name === 'corner' && settings.position ? 'custom' : settings[field.name];
  }
  sizeLabel.value = settings.size + ' px';
  showStatus(inputStatus);
  report(warning);
}

form.addEventListener('submit', event => event.preventDefault());
form.elements.size.oninput = event => { sizeLabel.value = event.target.value + ' px'; };
form.addEventListener('change', async ({target}) => {
  if (!target.name || !target.reportValidity()) return;
  const value = target.type === 'checkbox' ? target.checked :
    ['number', 'range'].includes(target.type) ? target.valueAsNumber : target.value;
  try {
    await api.updateSettings({[target.name]: value});
  } catch (error) {
    render(await api.getState());
    report(error.message);
  }
});
document.querySelector('#website').onclick = event => {
  event.preventDefault();
  api.openWebsite().catch(error => report(error.message));
};
document.querySelector('#permission').onclick = () => api.requestPermission().catch(error => report(error.message));
api.onState(render);
api.onInputStatus(showStatus);
api.getState().then(render).catch(error => report(error.message));
