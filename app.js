const storageKey = "wxyy-2-thin-section-index";
const state = JSON.parse(localStorage.getItem(storageKey) || '{"samples":[],"compare":[]}');

const form = document.querySelector("#sampleForm");
const formTitle = document.querySelector("#formTitle");
const submitBtn = document.querySelector("#submitBtn");
const cancelEditBtn = document.querySelector("#cancelEditBtn");
const photoInput = document.querySelector("#photoInput");
const photoHint = document.querySelector("#photoHint");
const sampleGrid = document.querySelector("#sampleGrid");
const comparePane = document.querySelector("#comparePane");
const mineralFilter = document.querySelector("#mineralFilter");
const polarFilter = document.querySelector("#polarFilter");
const statusFilter = document.querySelector("#statusFilter");

const STATUSES = ["待复核", "已确认", "需补拍"];

let pendingPhoto = "";
let editingId = null;

// 旧数据补齐状态与修订记录字段
state.samples = state.samples.map((sample) => ({
  status: "待复核",
  revisions: [],
  ...sample
}));
state.compare = (state.compare || []).filter((id) => state.samples.some((sample) => sample.id === id)).slice(0, 2);

function save() {
  localStorage.setItem(storageKey, JSON.stringify(state));
}

function readFileAsDataUrl(file) {
  return new Promise((resolve) => {
    if (!file) return resolve("");
    const reader = new FileReader();
    reader.addEventListener("load", () => resolve(reader.result));
    reader.readAsDataURL(file);
  });
}

function filteredSamples() {
  const mineral = mineralFilter.value.trim();
  const polarization = polarFilter.value;
  const status = statusFilter.value;
  return state.samples.filter((sample) => {
    const mineralMatch = !mineral || sample.minerals.includes(mineral);
    const polarMatch = !polarization || sample.polarization === polarization;
    const statusMatch = !status || sample.status === status;
    return mineralMatch && polarMatch && statusMatch;
  });
}

function statusOptions(current) {
  return STATUSES.map((status) => `<option ${status === current ? "selected" : ""}>${status}</option>`).join("");
}

function render() {
  const rows = filteredSamples();
  sampleGrid.innerHTML = rows.length ? rows.map((sample) => `
    <article class="sample-card">
      ${sample.photo ? `<img src="${sample.photo}" alt="${sample.code}显微照片">` : "<div class=\"photo-placeholder\"></div>"}
      <div class="sample-body">
        <div class="card-head">
          <h3>${sample.code}</h3>
          <span class="status-badge" data-status="${sample.status}">${sample.status}</span>
        </div>
        <p>${sample.location || "未记录地点"} · ${sample.magnification || "未记录倍数"} · ${sample.polarization}</p>
        <p>矿物：${sample.minerals || "未记录"}</p>
        <p>结构：${sample.texture || "未记录"}</p>
        <p>最新批注：${sample.comment || "未填写批注"}</p>
        <p>修订 ${sample.revisions.length} 次</p>
        <div class="card-actions">
          <label><input type="checkbox" data-compare="${sample.id}" ${state.compare.includes(sample.id) ? "checked" : ""}>对比</label>
          <select data-status-for="${sample.id}" title="状态">${statusOptions(sample.status)}</select>
        </div>
        <div class="card-actions">
          <button type="button" data-edit="${sample.id}">修改</button>
          <button type="button" data-delete="${sample.id}">删除</button>
        </div>
      </div>
    </article>
  `).join("") : "<p>还没有样本，先从左侧录入一张薄片照片。</p>";

  const compareSamples = state.compare
    .map((id) => state.samples.find((sample) => sample.id === id))
    .filter(Boolean)
    .slice(0, 2);

  comparePane.innerHTML = compareSamples.length ? compareSamples.map((sample) => `
    <article class="compare-item">
      ${sample.photo ? `<img src="${sample.photo}" alt="${sample.code}对比图">` : ""}
      <div class="card-head">
        <h3>${sample.code}</h3>
        <span class="status-badge" data-status="${sample.status}">${sample.status}</span>
      </div>
      <p>${sample.polarization} · ${sample.minerals || "未记录矿物"}</p>
      <p>${sample.texture || "未记录结构"}</p>
      <p>最新批注：${sample.comment || "未填写批注"} · 修订 ${sample.revisions.length} 次</p>
    </article>
  `).join("") : "<p>勾选两张样本卡片后可并排对比。</p>";
}

function resetForm() {
  editingId = null;
  pendingPhoto = "";
  photoInput.value = "";
  form.reset();
  formTitle.textContent = "样本录入";
  submitBtn.textContent = "保存样本";
  cancelEditBtn.hidden = true;
  photoHint.hidden = true;
}

function startEdit(id) {
  const sample = state.samples.find((item) => item.id === id);
  if (!sample) return;
  editingId = id;
  pendingPhoto = "";
  photoInput.value = "";
  form.elements.code.value = sample.code;
  form.elements.location.value = sample.location;
  form.elements.magnification.value = sample.magnification;
  form.elements.polarization.value = sample.polarization;
  form.elements.minerals.value = sample.minerals;
  form.elements.texture.value = sample.texture;
  form.elements.status.value = sample.status;
  form.elements.comment.value = sample.comment;
  formTitle.textContent = `修改样本 ${sample.code}`;
  submitBtn.textContent = "保存修改";
  cancelEditBtn.hidden = false;
  photoHint.hidden = false;
  form.scrollIntoView({ behavior: "smooth", block: "start" });
}

photoInput.addEventListener("change", async () => {
  pendingPhoto = await readFileAsDataUrl(photoInput.files[0]);
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const data = new FormData(form);
  if (!pendingPhoto && photoInput.files[0]) {
    pendingPhoto = await readFileAsDataUrl(photoInput.files[0]);
  }
  const fields = {
    code: data.get("code").trim(),
    location: data.get("location").trim(),
    magnification: data.get("magnification").trim(),
    polarization: data.get("polarization"),
    minerals: data.get("minerals").trim(),
    texture: data.get("texture").trim(),
    status: data.get("status"),
    comment: data.get("comment").trim()
  };
  if (editingId) {
    const sample = state.samples.find((item) => item.id === editingId);
    if (sample) {
      Object.assign(sample, fields);
      if (pendingPhoto) sample.photo = pendingPhoto;
      sample.revisions.push({ at: new Date().toISOString(), comment: fields.comment });
    }
  } else {
    state.samples.unshift({
      id: crypto.randomUUID(),
      photo: pendingPhoto,
      ...fields,
      revisions: [],
      createdAt: new Date().toISOString()
    });
  }
  resetForm();
  save();
  render();
});

cancelEditBtn.addEventListener("click", resetForm);

sampleGrid.addEventListener("click", (event) => {
  const editId = event.target.dataset.edit;
  if (editId) {
    startEdit(editId);
    return;
  }
  const deleteId = event.target.dataset.delete;
  if (deleteId) {
    // 样本移除时，其修订记录随样本一起清理
    state.samples = state.samples.filter((sample) => sample.id !== deleteId);
    state.compare = state.compare.filter((id) => id !== deleteId);
    if (editingId === deleteId) resetForm();
    save();
    render();
  }
});

sampleGrid.addEventListener("change", (event) => {
  const statusId = event.target.dataset.statusFor;
  if (statusId) {
    const sample = state.samples.find((item) => item.id === statusId);
    if (sample && STATUSES.includes(event.target.value)) {
      sample.status = event.target.value;
      save();
      render();
    }
    return;
  }
  const id = event.target.dataset.compare;
  if (!id) return;
  if (event.target.checked) {
    const rest = state.compare.filter((item) => item !== id);
    // 两个对比位置固定：有空位就补到末尾，满了只替换最早的一格，另一格不动
    state.compare = rest.length < 2 ? [...rest, id] : [id, rest[1]];
  } else {
    state.compare = state.compare.filter((item) => item !== id);
  }
  save();
  render();
});

[mineralFilter, polarFilter, statusFilter].forEach((field) => field.addEventListener("input", render));

document.querySelector("#exportBtn").addEventListener("click", () => {
  const checklist = filteredSamples().map((sample) => ({
    样本编号: sample.code,
    采样地点: sample.location,
    放大倍数: sample.magnification,
    偏光类型: sample.polarization,
    主要矿物: sample.minerals,
    颗粒结构: sample.texture,
    状态: sample.status,
    最新批注: sample.comment,
    修订次数: sample.revisions.length
  }));
  const blob = new Blob([JSON.stringify(checklist, null, 2)], { type: "application/json" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = "thin-section-checklist.json";
  link.click();
  URL.revokeObjectURL(link.href);
});

render();
