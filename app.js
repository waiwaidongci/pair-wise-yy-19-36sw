const storageKey = "wxyy-2-thin-section-index";

const STATUS_OPTIONS = [
  { value: "pending", label: "待复核" },
  { value: "confirmed", label: "已确认" },
  { value: "rephoto", label: "需补拍" }
];
const STATUS_LABELS = Object.fromEntries(STATUS_OPTIONS.map((option) => [option.value, option.label]));

function normalizeSample(sample) {
  return {
    status: "pending",
    revisionCount: 0,
    revisions: [],
    ...sample
  };
}

function loadState() {
  try {
    const parsed = JSON.parse(localStorage.getItem(storageKey) || "{}");
    return {
      samples: (parsed.samples || []).map(normalizeSample),
      compare: Array.isArray(parsed.compare) ? parsed.compare : []
    };
  } catch {
    return { samples: [], compare: [] };
  }
}

const state = loadState();

const form = document.querySelector("#sampleForm");
const photoInput = document.querySelector("#photoInput");
const photoPreview = document.querySelector("#photoPreview");
const photoPreviewImg = document.querySelector("#photoPreviewImg");
const photoPreviewHint = document.querySelector("#photoPreviewHint");
const photoRevertBtn = document.querySelector("#photoRevertBtn");
const saveBtn = document.querySelector("#saveBtn");
const cancelBtn = document.querySelector("#cancelBtn");
const sampleGrid = document.querySelector("#sampleGrid");
const comparePane = document.querySelector("#comparePane");
const mineralFilter = document.querySelector("#mineralFilter");
const polarFilter = document.querySelector("#polarFilter");
const statusFilter = document.querySelector("#statusFilter");

let editingId = null;
let pendingPhoto = "";

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

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[char]);
}

function formatTime(isoString) {
  const date = new Date(isoString);
  return Number.isNaN(date.getTime()) ? "" : date.toLocaleString("zh-CN", { hour12: false });
}

function editingSample() {
  return state.samples.find((sample) => sample.id === editingId) || null;
}

function syncPhotoPreview() {
  const sample = editingSample();
  const photo = pendingPhoto || (sample && sample.photo) || "";
  photoPreview.hidden = !photo;
  if (!photo) return;
  photoPreviewImg.src = photo;
  photoPreviewImg.alt = sample ? `${sample.code}显微照片预览` : "新照片预览";
  if (sample) {
    photoPreviewHint.textContent = pendingPhoto ? "已选择新照片，提交后替换原照片" : "未另选照片，提交后沿用原照片";
    photoRevertBtn.hidden = !pendingPhoto;
  } else {
    photoPreviewHint.textContent = "新样本照片预览";
    photoRevertBtn.hidden = true;
  }
}

function resetEditor() {
  editingId = null;
  pendingPhoto = "";
  photoInput.value = "";
  form.reset();
  saveBtn.textContent = "保存样本";
  cancelBtn.hidden = true;
  syncPhotoPreview();
}

function startEdit(id) {
  const sample = state.samples.find((item) => item.id === id);
  if (!sample) return;
  editingId = id;
  pendingPhoto = "";
  photoInput.value = "";
  form.elements.code.value = sample.code;
  form.elements.location.value = sample.location || "";
  form.elements.magnification.value = sample.magnification || "";
  form.elements.polarization.value = sample.polarization;
  form.elements.minerals.value = sample.minerals || "";
  form.elements.texture.value = sample.texture || "";
  form.elements.comment.value = sample.comment || "";
  saveBtn.textContent = "保存修改";
  cancelBtn.hidden = false;
  syncPhotoPreview();
  form.scrollIntoView?.({ behavior: "smooth", block: "start" });
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

function statusOptionsHtml(current) {
  return STATUS_OPTIONS.map((option) =>
    `<option value="${option.value}" ${option.value === current ? "selected" : ""}>${option.label}</option>`
  ).join("");
}

function revisionLogHtml(sample) {
  if (!sample.revisions.length) return "";
  const entries = [...sample.revisions].reverse().map((revision) => {
    const label = revision.revision === 0 ? "初始录入" : `第${revision.revision}次修订`;
    return `
    <li>
      <span class="revision-meta">${label} · ${formatTime(revision.at)}</span>
      <span class="revision-comment">${escapeHtml(revision.comment) || "（无批注）"}</span>
    </li>
  `;
  }).join("");
  return `
    <details class="revision-log">
      <summary>提交记录（${sample.revisions.length}）</summary>
      <ol>${entries}</ol>
    </details>
  `;
}

function render() {
  const rows = filteredSamples();
  sampleGrid.innerHTML = rows.length ? rows.map((sample) => `
    <article class="sample-card">
      ${sample.photo ? `<img src="${sample.photo}" alt="${escapeHtml(sample.code)}显微照片">` : "<div class=\"photo-placeholder\"></div>"}
      <div class="sample-body">
        <div class="card-head">
          <h3>${escapeHtml(sample.code)}</h3>
          <span class="status-badge status-${sample.status}">${STATUS_LABELS[sample.status]}</span>
        </div>
        <p>${escapeHtml(sample.location) || "未记录地点"} · ${escapeHtml(sample.magnification) || "未记录倍数"} · ${escapeHtml(sample.polarization)}</p>
        <p>矿物：${escapeHtml(sample.minerals) || "未记录"}</p>
        <p>结构：${escapeHtml(sample.texture) || "未记录"}</p>
        <p>批注：${escapeHtml(sample.comment) || "未填写批注"}</p>
        <p class="revision-meta">修订 ${sample.revisionCount} 次</p>
        ${revisionLogHtml(sample)}
        <label class="status-line">状态
          <select data-status="${sample.id}">${statusOptionsHtml(sample.status)}</select>
        </label>
        <div class="card-actions">
          <label><input type="checkbox" data-compare="${sample.id}" ${state.compare.includes(sample.id) ? "checked" : ""}>对比</label>
          <button type="button" data-edit="${sample.id}">修改</button>
          <button type="button" class="danger-btn" data-delete="${sample.id}">删除</button>
        </div>
      </div>
    </article>
  `).join("") : "<p>没有符合筛选条件的样本，调整筛选或从左侧录入。</p>";

  // 按槽位顺序渲染，空槽位占位；编辑样本时只更新内容、不打乱左右位置
  const compareIds = state.compare.slice(0, 2);
  const compareSamples = compareIds
    .map((id) => (id ? state.samples.find((sample) => sample.id === id) || null : null));

  comparePane.innerHTML = compareSamples.some(Boolean) ? compareSamples.map((sample, index) => `
    <article class="compare-item">
      <p class="compare-slot">对比位 ${index + 1}</p>
      ${sample ? `
        ${sample.photo ? `<img src="${sample.photo}" alt="${escapeHtml(sample.code)}对比图">` : ""}
        <h3>${escapeHtml(sample.code)}</h3>
        <p><span class="status-badge status-${sample.status}">${STATUS_LABELS[sample.status]}</span> ${escapeHtml(sample.polarization)} · ${escapeHtml(sample.minerals) || "未记录矿物"}</p>
        <p>${escapeHtml(sample.texture) || "未记录结构"}</p>
        <p>批注：${escapeHtml(sample.comment) || "未填写批注"}</p>
      ` : "<p class=\"compare-empty\">该位置空闲，勾选卡片补入。</p>"}
    </article>
  `).join("") : "<p>勾选两张样本卡片后可并排对比。</p>";
}

photoInput.addEventListener("change", async () => {
  pendingPhoto = await readFileAsDataUrl(photoInput.files[0]);
  syncPhotoPreview();
});

photoRevertBtn.addEventListener("click", () => {
  pendingPhoto = "";
  photoInput.value = "";
  syncPhotoPreview();
});

cancelBtn.addEventListener("click", resetEditor);

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
    comment: data.get("comment").trim()
  };
  const now = new Date().toISOString();
  const target = editingSample();
  if (target) {
    // 原地更新，保证对比槽位顺序不变；未另选照片时沿用原照片
    Object.assign(target, fields, {
      photo: pendingPhoto || target.photo,
      revisionCount: target.revisionCount + 1,
      updatedAt: now
    });
    target.revisions.push({ at: now, comment: fields.comment, revision: target.revisionCount });
  } else {
    state.samples.unshift({
      id: crypto.randomUUID(),
      photo: pendingPhoto,
      ...fields,
      status: "pending",
      revisionCount: 0,
      revisions: [{ at: now, comment: fields.comment, revision: 0 }],
      createdAt: now
    });
  }
  resetEditor();
  save();
  render();
});

sampleGrid.addEventListener("click", (event) => {
  const editId = event.target.dataset.edit;
  if (editId) {
    startEdit(editId);
    return;
  }
  const deleteId = event.target.dataset.delete;
  if (deleteId) {
    // 修订记录随样本一并移除，对比槽位清空为占位而不是收缩，避免另一张移位
    state.samples = state.samples.filter((sample) => sample.id !== deleteId);
    state.compare = state.compare.map((id) => (id === deleteId ? null : id));
    if (editingId === deleteId) resetEditor();
    save();
    render();
  }
});

sampleGrid.addEventListener("change", (event) => {
  const compareId = event.target.dataset.compare;
  if (compareId) {
    if (event.target.checked) {
      // 优先补入空槽位，保持已有卡片的位置不变；两槽都占时新卡片放入对比位 2
      const slots = [...state.compare];
      if (slots.includes(compareId)) {
        // 已在对比中，无需处理
      } else {
        const holeIndex = slots.findIndex((id) => !id);
        if (holeIndex >= 0) {
          slots[holeIndex] = compareId;
        } else if (slots.length < 2) {
          slots.push(compareId);
        } else {
          slots[1] = compareId;
        }
        state.compare = slots.slice(0, 2);
      }
    } else {
      state.compare = state.compare.map((id) => (id === compareId ? null : id));
    }
    save();
    render();
    return;
  }
  const statusId = event.target.dataset.status;
  if (statusId) {
    const sample = state.samples.find((item) => item.id === statusId);
    if (!sample) return;
    sample.status = event.target.value;
    save();
    render();
  }
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
    状态: STATUS_LABELS[sample.status],
    最新批注: sample.comment,
    修订次数: sample.revisionCount
  }));
  const blob = new Blob([JSON.stringify(checklist, null, 2)], { type: "application/json" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = "thin-section-checklist.json";
  link.click();
  URL.revokeObjectURL(link.href);
});

save();
render();
