const SIGNATURE_CHOICE_KEY = 'demandes:v70:signature-choice';
const SIGNATURE_DATA_KEY = 'demandes:v70:signature-data';
const STROKE_FACTORS = { fine: 0.68, normal: 1, thick: 1.38 };

export function usesPersistentMobileSignature(win) {
  return Boolean(
    win.matchMedia &&
      (win.matchMedia('(max-width:760px)').matches ||
        win.matchMedia('(pointer:coarse)').matches),
  );
}

export function signatureStrokeWidth({ panelZoom, browserZoom, finePointer, stroke }) {
  const visibleZoom = Math.max(0.35, panelZoom * browserZoom);
  const baseCssPixels = finePointer ? 2.8 : 3.8;
  const strokeFactor = STROKE_FACTORS[stroke] || 1;
  const cssPixels = (baseCssPixels * strokeFactor) / visibleZoom;
  return Math.max(finePointer ? 1 : 1.25, Math.min(finePointer ? 4.5 : 5.5, cssPixels));
}

export function createSignatureController(options) {
  const {
    win,
    doc,
    elements,
    canvasScale,
    getModel,
    getHasInk,
    setHasInk,
    getPdfDone,
    setPdfDone,
    getOwnerSuffix,
    getPlanningProfile,
    getFieldValue,
    onPlanningProfileSynced,
    closeEditor,
    scheduleSave,
    say,
    showToast,
    getModalZoom,
    applyModalZoom,
  } = options;
  const {
    canvas,
    hint,
    clearButton,
    saveButton,
    deleteButton,
    modal,
    bigCanvas,
    modeBar,
    typeBox,
    drawHint,
    typedName,
    typedFont,
    strokeControl,
    canvasWrap,
    modeTypeButton,
    modeDrawButton,
    modalClearButton,
    modalCancelButton,
    modalOkButton,
    savePrompt,
    savePromptBox,
    saveYesButton,
    saveNoButton,
  } = elements;
  const context = canvas.getContext('2d');
  const bigContext = bigCanvas.getContext('2d');
  const bigCanvasScale = Math.min(3, win.devicePixelRatio || 2);
  const finePointer = win.matchMedia ? win.matchMedia('(pointer:fine)').matches : true;
  let choiceMemory = '';
  let dataMemory = '';
  let bigDrawing = false;
  let bigLast = null;
  let bigHasInk = false;
  let mode = finePointer ? 'type' : 'draw';
  let stroke = win.localStorage.getItem('signatureStroke') || 'normal';

  function storageKey(prefix) {
    return prefix + getOwnerSuffix();
  }

  function signatureChoice() {
    try {
      return win.localStorage.getItem(storageKey(SIGNATURE_CHOICE_KEY)) || choiceMemory || '';
    } catch {
      return choiceMemory || '';
    }
  }

  function signatureData() {
    try {
      return win.localStorage.getItem(storageKey(SIGNATURE_DATA_KEY)) || dataMemory || '';
    } catch {
      return dataMemory || '';
    }
  }

  function setSignatureChoice(value) {
    choiceMemory = value || '';
    try {
      if (value) win.localStorage.setItem(storageKey(SIGNATURE_CHOICE_KEY), value);
      else win.localStorage.removeItem(storageKey(SIGNATURE_CHOICE_KEY));
    } catch {}
  }

  function setSignatureData(value) {
    dataMemory = value || '';
    try {
      if (value) win.localStorage.setItem(storageKey(SIGNATURE_DATA_KEY), value);
      else win.localStorage.removeItem(storageKey(SIGNATURE_DATA_KEY));
    } catch {}
  }

  function mobilePersistence() {
    return usesPersistentMobileSignature(win);
  }

  function updatePersistenceUI() {
    if (!saveButton || !deleteButton) return;
    const mobile = mobilePersistence();
    const choice = signatureChoice();
    const data = signatureData();
    saveButton.style.display = mobile && getHasInk() && choice === 'declined' ? 'block' : 'none';
    deleteButton.style.display = mobile && choice === 'saved' && Boolean(data) ? 'flex' : 'none';
  }

  function updateClearButton() {
    clearButton.style.display = !mobilePersistence() && getHasInk() && !getPdfDone() ? 'block' : 'none';
    updatePersistenceUI();
  }

  function canSyncWithPlanning() {
    try {
      const publicDemoUntil = win.localStorage.getItem('planning:public-demo-until');
      const publicDemo =
        publicDemoUntil &&
        Number.isFinite(Date.parse(publicDemoUntil)) &&
        Date.now() <= Date.parse(publicDemoUntil);
      const e2eDemo =
        publicDemo ||
        ((win.location.hostname === '127.0.0.1' || win.location.hostname === 'localhost') &&
          win.localStorage.getItem('planning:e2e-demo-enabled') === '1');
      return !e2eDemo;
    } catch {
      return false;
    }
  }

  function syncSavedSignatureToPlanning(data, showConfirmation) {
    if (!canSyncWithPlanning()) return Promise.resolve(false);
    const profile = getPlanningProfile() || {};
    const fullName = profile.fullName || getFieldValue('nom');
    const group = profile.group || getFieldValue('groupe');
    if (profile.signature === data) return Promise.resolve(true);
    return win
      .fetch('/api/calendar', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          action: 'save-form-profile',
          fullName,
          group,
          signature: data,
        }),
      })
      .then((response) => {
        if (!response.ok) throw new Error('Synchronisation refusée');
        onPlanningProfileSynced({ ...profile, fullName, group, signature: data });
        if (showConfirmation) {
          say('Signature enregistrée et synchronisée avec votre compte.');
          showToast('Signature synchronisée');
        }
        return true;
      })
      .catch(() => {
        if (showConfirmation)
          say(
            'Signature enregistrée sur ce téléphone, mais la synchronisation a échoué. Réessayez avec une connexion internet.',
          );
        return false;
      });
  }

  function savePermanently(showConfirmation) {
    if (!mobilePersistence() || !getHasInk()) return false;
    let data = '';
    try {
      data = canvas.toDataURL('image/png');
    } catch {}
    if (!data) return false;
    setSignatureData(data);
    setSignatureChoice('saved');
    updatePersistenceUI();
    if (showConfirmation) {
      say('Signature enregistrée. Synchronisation en cours…');
      showToast('Signature enregistrée');
    }
    void syncSavedSignatureToPlanning(data, showConfirmation);
    return true;
  }

  function restoreSaved() {
    if (!mobilePersistence() || signatureChoice() !== 'saved') {
      updatePersistenceUI();
      return Promise.resolve(false);
    }
    const data = signatureData();
    if (!data) {
      setSignatureChoice('');
      updatePersistenceUI();
      return Promise.resolve(false);
    }
    return new Promise((resolve) => {
      const image = new Image();
      image.onload = () => {
        context.clearRect(0, 0, canvas.width, canvas.height);
        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        setHasInk(true);
        canvas.classList.add('has');
        hint.style.display = 'none';
        setPdfDone(false);
        updateClearButton();
        resolve(true);
      };
      image.onerror = () => resolve(false);
      image.src = data;
    });
  }

  function fitSavePromptToVisualViewport() {
    if (!savePrompt || !savePromptBox) return;
    const viewport = win.visualViewport;
    const browserScale = viewport && viewport.scale ? viewport.scale : 1;
    if (viewport) {
      savePrompt.style.left = viewport.offsetLeft + 'px';
      savePrompt.style.top = viewport.offsetTop + 'px';
      savePrompt.style.width = viewport.width + 'px';
      savePrompt.style.height = viewport.height + 'px';
      savePrompt.style.right = 'auto';
      savePrompt.style.bottom = 'auto';
    }
    const layoutWidth = Math.max(doc.documentElement.clientWidth || 0, win.innerWidth || 0);
    savePromptBox.style.width = Math.min(340, Math.max(250, layoutWidth - 32)) + 'px';
    savePromptBox.style.transform = browserScale > 1.01 ? `scale(${1 / browserScale})` : '';
  }

  function closeSavePrompt() {
    savePrompt.classList.remove('on');
    doc.body.style.overflow = '';
  }

  function showSavePrompt() {
    if (!mobilePersistence() || signatureChoice() || !getHasInk()) return;
    fitSavePromptToVisualViewport();
    savePrompt.classList.add('on');
    doc.body.style.overflow = 'hidden';
    win.requestAnimationFrame(() => saveYesButton.focus());
  }

  function handleValidatedMobileSignature() {
    if (!mobilePersistence() || !getHasInk()) return;
    const choice = signatureChoice();
    if (choice === 'saved') savePermanently(false);
    else if (choice === 'declined') updatePersistenceUI();
    else showSavePrompt();
  }

  function size(scale) {
    const model = getModel();
    if (!model) return;
    const signatureBox = model.sig;
    const clearBox = model.clr;
    const left = signatureBox[0] * scale;
    const top = signatureBox[1] * scale;
    const width = (signatureBox[2] - signatureBox[0]) * scale;
    const height = (signatureBox[3] - signatureBox[1]) * scale;
    [canvas, hint].forEach((element) => {
      element.style.left = left + 'px';
      element.style.top = top + 'px';
      element.style.width = width + 'px';
      element.style.height = height + 'px';
    });
    hint.style.lineHeight = height + 'px';
    const boxWidth = (clearBox[2] - clearBox[0]) * scale;
    const boxHeight = (clearBox[3] - clearBox[1]) * scale;
    const actionWidth = Math.max(46, boxWidth - 10);
    clearButton.style.width = actionWidth + 'px';
    clearButton.style.fontSize = Math.max(7, Math.min(13, 19 * scale)) + 'px';
    clearButton.style.left = clearBox[0] * scale + (boxWidth - actionWidth) / 2 + 'px';
    clearButton.style.top = clearBox[1] * scale + boxHeight / 2 - Math.min(boxHeight / 2, 18) + 'px';
    saveButton.style.width = actionWidth + 'px';
    saveButton.style.fontSize = Math.max(7, Math.min(12, 18 * scale)) + 'px';
    saveButton.style.left = clearBox[0] * scale + (boxWidth - actionWidth) / 2 + 'px';
    saveButton.style.top = clearBox[1] * scale + boxHeight / 2 - Math.min(boxHeight / 2, 18) + 'px';
    const crossSize = Math.max(22, Math.min(30, height * 0.3));
    deleteButton.style.width = crossSize + 'px';
    deleteButton.style.height = crossSize + 'px';
    deleteButton.style.left = left + width - crossSize - 2 + 'px';
    deleteButton.style.top = top + 2 + 'px';
    const canvasWidth = (signatureBox[2] - signatureBox[0]) * canvasScale;
    const canvasHeight = (signatureBox[3] - signatureBox[1]) * canvasScale;
    if (canvas.width === canvasWidth && canvas.height === canvasHeight) return;
    canvas.width = canvasWidth;
    canvas.height = canvasHeight;
    context.lineCap = 'round';
    context.lineJoin = 'round';
    context.strokeStyle = '#0b3baf';
    context.lineWidth = 8;
  }

  function clear() {
    context.clearRect(0, 0, canvas.width, canvas.height);
    setHasInk(false);
    canvas.classList.remove('has');
    hint.style.display = '';
    updateClearButton();
  }

  function updateStrokeControl() {
    strokeControl.querySelectorAll('button[data-stroke]').forEach((button) => {
      button.classList.toggle('on', button.getAttribute('data-stroke') === stroke);
    });
  }

  function profileName() {
    return ['prenom', 'nom']
      .map((name) => getFieldValue(name))
      .filter(Boolean)
      .join(' ');
  }

  function styleValue() {
    return win.matchMedia('(min-width:761px)').matches ? 'simple' : typedFont.value;
  }

  function signatureFont() {
    const value = styleValue();
    if (value === 'elegant') return '"Lucida Handwriting", "Segoe Script", "Snell Roundhand", cursive';
    if (value === 'simple') return '"Segoe Print", "Bradley Hand", "Comic Sans MS", cursive';
    return '"Segoe Script", "Snell Roundhand", "Lucida Handwriting", "Brush Script MT", cursive';
  }

  function renderTypedSignature() {
    if (mode !== 'type') return;
    bigContext.clearRect(0, 0, bigCanvas.width, bigCanvas.height);
    const text = typedName.value.trim();
    bigHasInk = Boolean(text);
    if (!text) return;
    const maximumWidth = bigCanvas.width * 0.88;
    const maximumHeight = bigCanvas.height * 0.68;
    let fontSize = Math.max(24, Math.round(bigCanvas.height * 0.58));
    bigContext.textAlign = 'center';
    bigContext.textBaseline = 'middle';
    bigContext.fillStyle = '#0b3baf';
    while (fontSize > 18) {
      bigContext.font = (styleValue() === 'simple' ? '500 ' : '400 ') + fontSize + 'px ' + signatureFont();
      if (bigContext.measureText(text).width <= maximumWidth && fontSize <= maximumHeight) break;
      fontSize -= 2;
    }
    bigContext.font = (styleValue() === 'simple' ? '500 ' : '400 ') + fontSize + 'px ' + signatureFont();
    bigContext.fillText(text, bigCanvas.width / 2, bigCanvas.height / 2);
  }

  function setMode(nextMode) {
    mode = nextMode;
    const typed = mode === 'type';
    modeBar.classList.toggle('on', finePointer);
    typeBox.classList.toggle('on', typed && finePointer);
    drawHint.classList.toggle('on', !typed || !finePointer);
    strokeControl.classList.toggle('hidden', typed && finePointer);
    modeTypeButton.className = 'btn ' + (typed ? '' : 'ghost');
    modeDrawButton.className = 'btn ' + (typed ? 'ghost' : '');
    bigCanvas.style.cursor = typed ? 'default' : 'crosshair';
    bigCanvas.style.pointerEvents = typed ? 'none' : 'auto';
    if (typed) {
      if (!typedName.value) typedName.value = profileName();
      renderTypedSignature();
    } else {
      bigContext.clearRect(0, 0, bigCanvas.width, bigCanvas.height);
      bigHasInk = false;
    }
  }

  function currentStrokeWidth() {
    const viewport = win.visualViewport;
    return signatureStrokeWidth({
      panelZoom: getModalZoom(),
      browserZoom: modal.classList.contains('on') && viewport && viewport.scale ? viewport.scale : 1,
      finePointer,
      stroke,
    });
  }

  function sizeBig() {
    const bounds = canvasWrap.getBoundingClientRect();
    const data = bigHasInk ? bigCanvas.toDataURL() : null;
    bigCanvas.width = Math.max(1, Math.round(bounds.width * bigCanvasScale));
    bigCanvas.height = Math.max(1, Math.round(bounds.height * bigCanvasScale));
    bigContext.lineCap = 'round';
    bigContext.lineJoin = 'round';
    bigContext.strokeStyle = '#0b3baf';
    bigContext.lineWidth = currentStrokeWidth() * bigCanvasScale;
    if (mode === 'type') renderTypedSignature();
    else if (data) {
      const image = new Image();
      image.onload = () => bigContext.drawImage(image, 0, 0, bigCanvas.width, bigCanvas.height);
      image.src = data;
    }
  }

  function bigPoint(event) {
    const bounds = bigCanvas.getBoundingClientRect();
    return {
      x: ((event.clientX - bounds.left) / bounds.width) * bigCanvas.width,
      y: ((event.clientY - bounds.top) / bounds.height) * bigCanvas.height,
    };
  }

  function fitModalToVisualViewport() {
    const viewport = win.visualViewport;
    if (viewport) {
      modal.style.left = viewport.offsetLeft + 'px';
      modal.style.top = viewport.offsetTop + 'px';
      modal.style.width = viewport.width + 'px';
      modal.style.height = viewport.height + 'px';
      modal.style.right = 'auto';
      modal.style.bottom = 'auto';
    }
    applyModalZoom('sigPanel');
  }

  function openModal() {
    if (win.matchMedia('(min-width:761px)').matches) typedFont.value = 'simple';
    modal.classList.add('on');
    doc.body.style.overflow = 'hidden';
    fitModalToVisualViewport();
    bigHasInk = getHasInk();
    if (finePointer) {
      if (!typedName.value) typedName.value = profileName();
      setMode(getHasInk() ? 'draw' : 'type');
    } else setMode('draw');
    win.requestAnimationFrame(() => {
      sizeBig();
      if (!getHasInk() && mode === 'draw')
        bigContext.clearRect(0, 0, bigCanvas.width, bigCanvas.height);
    });
  }

  function closeModal() {
    modal.classList.remove('on');
    doc.body.style.overflow = '';
    modal.style.left = '';
    modal.style.top = '';
    modal.style.width = '';
    modal.style.height = '';
    modal.style.right = '';
    modal.style.bottom = '';
  }

  canvas.addEventListener('pointerdown', (event) => {
    event.preventDefault();
    closeEditor();
    openModal();
  });
  clearButton.addEventListener('click', (event) => {
    event.preventDefault();
    clear();
    scheduleSave();
    say('Signature effacée, tu peux recommencer.');
  });
  saveButton.addEventListener('click', (event) => {
    event.preventDefault();
    if (!savePermanently(true)) say('La signature n’a pas pu être enregistrée.');
  });
  deleteButton.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopPropagation();
    if (!win.confirm('Supprimer la signature enregistrée sur cet appareil ?')) return;
    setSignatureData('');
    setSignatureChoice('');
    void syncSavedSignatureToPlanning('', false);
    clear();
    scheduleSave();
    say('Signature enregistrée supprimée. Vous pouvez recommencer.');
    showToast('Signature supprimée');
  });
  strokeControl.addEventListener('click', (event) => {
    const button = event.target.closest('button[data-stroke]');
    if (!button) return;
    stroke = button.getAttribute('data-stroke');
    win.localStorage.setItem('signatureStroke', stroke);
    updateStrokeControl();
  });
  modeTypeButton.addEventListener('click', () => setMode('type'));
  modeDrawButton.addEventListener('click', () => setMode('draw'));
  typedName.addEventListener('input', renderTypedSignature);
  typedFont.addEventListener('change', renderTypedSignature);
  bigCanvas.addEventListener('pointerdown', (event) => {
    if (mode !== 'draw') return;
    event.preventDefault();
    bigCanvas.setPointerCapture(event.pointerId);
    bigDrawing = true;
    bigLast = bigPoint(event);
    bigContext.lineWidth = currentStrokeWidth() * bigCanvasScale;
    bigContext.beginPath();
    bigContext.moveTo(bigLast.x, bigLast.y);
    bigContext.lineTo(bigLast.x + 0.1, bigLast.y + 0.1);
    bigContext.stroke();
    bigHasInk = true;
  });
  bigCanvas.addEventListener('pointermove', (event) => {
    if (!bigDrawing) return;
    event.preventDefault();
    const point = bigPoint(event);
    bigContext.lineWidth = currentStrokeWidth() * bigCanvasScale;
    bigContext.beginPath();
    bigContext.moveTo(bigLast.x, bigLast.y);
    bigContext.lineTo(point.x, point.y);
    bigContext.stroke();
    bigLast = point;
  });
  ['pointerup', 'pointercancel'].forEach((eventName) => {
    bigCanvas.addEventListener(eventName, () => {
      bigDrawing = false;
    });
  });
  modalClearButton.addEventListener('click', () => {
    bigContext.clearRect(0, 0, bigCanvas.width, bigCanvas.height);
    if (mode === 'type') typedName.value = '';
    bigHasInk = false;
  });
  modalCancelButton.addEventListener('click', closeModal);
  modalOkButton.addEventListener('click', () => {
    context.clearRect(0, 0, canvas.width, canvas.height);
    if (bigHasInk) {
      const scale = Math.min(canvas.width / bigCanvas.width, canvas.height / bigCanvas.height);
      const width = bigCanvas.width * scale;
      const height = bigCanvas.height * scale;
      context.drawImage(bigCanvas, (canvas.width - width) / 2, (canvas.height - height) / 2, width, height);
      setHasInk(true);
      canvas.classList.add('has');
      hint.style.display = 'none';
    } else {
      setHasInk(false);
      canvas.classList.remove('has');
      hint.style.display = '';
    }
    canvas.classList.remove('err');
    setPdfDone(false);
    updateClearButton();
    scheduleSave();
    closeModal();
    handleValidatedMobileSignature();
  });
  saveYesButton.addEventListener('click', () => {
    if (savePermanently(true)) closeSavePrompt();
    else say('La signature n’a pas pu être enregistrée.');
  });
  saveNoButton.addEventListener('click', () => {
    setSignatureChoice('declined');
    closeSavePrompt();
    updatePersistenceUI();
    say('La proposition ne sera plus affichée automatiquement.');
  });
  modal.addEventListener('pointerdown', (event) => {
    if (event.target === modal) closeModal();
  });
  win.addEventListener('resize', () => {
    if (!modal.classList.contains('on')) return;
    win.clearTimeout(win.__rzb);
    win.__rzb = win.setTimeout(() => {
      fitModalToVisualViewport();
      sizeBig();
    }, 150);
  });
  const visualViewportUpdate = () => {
    if (modal.classList.contains('on')) fitModalToVisualViewport();
    if (savePrompt.classList.contains('on')) fitSavePromptToVisualViewport();
  };
  if (win.visualViewport) {
    win.visualViewport.addEventListener('resize', visualViewportUpdate);
    win.visualViewport.addEventListener('scroll', visualViewportUpdate);
  }
  updateStrokeControl();

  return {
    clear,
    closeModal,
    closeSavePrompt,
    mobilePersistence,
    openModal,
    restoreSaved,
    size,
    sizeBig,
    updateClearButton,
    updatePersistenceUI,
  };
}
