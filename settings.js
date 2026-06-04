
document.addEventListener('DOMContentLoaded', () => {
  const extActive = document.getElementById('ext-active');
  const mainSettings = document.getElementById('main-settings');
  const displayMode = document.getElementById('display-mode');
  const fontFamily = document.getElementById('font-family');
  const typingEffect = document.getElementById('typing-effect');
  const googleTranslate = document.getElementById('google-translate');
  const recordUntranslated = document.getElementById('record-untranslated');
  const recordSubSettings = document.getElementById('record-sub-settings');
  const untranslatedContainer = document.getElementById('untranslated-list-container');
  const btnImport = document.getElementById('btn-import');
  const fileInput = document.getElementById('file-input');
  const btnGithub = document.getElementById('btn-github');
  const btnClear = document.getElementById('btn-clear');
  const dictDesc = document.getElementById('dict-desc');
  const defaultDictDesc = '사용자가 직접 정의한 단어장 파일(.json)을 가져와 반영합니다.';

  let isDictApplied = false;

  chrome.storage.local.get({
    extActive: true,
    displayMode: 'ko-only',
    fontFamily: 'system',
    typingEffect: true,
    googleTranslate: false,
    recordUntranslated: true,
    untranslatedList: [],
    customDictName: ''
  }, (items) => {
    extActive.checked = items.extActive;
    displayMode.value = items.displayMode;
    fontFamily.value = items.fontFamily;
    typingEffect.checked = items.typingEffect;
    googleTranslate.checked = items.googleTranslate;
    recordUntranslated.checked = items.recordUntranslated;

    toggleSection(mainSettings, items.extActive);
    toggleSection(recordSubSettings, items.recordUntranslated);

    renderUntranslated(items.untranslatedList);

    if (items.customDictName) {
      updateDictUI(true, items.customDictName);
    } else {
      updateDictUI(false);
    }
  });

  function toggleSection(element, show) {
    if (show) {
      element.classList.remove('hidden');
    } else {
      element.classList.add('hidden');
    }
  }

  function renderUntranslated(list) {
    untranslatedContainer.innerHTML = '';
    if (!list || list.length === 0) {
      untranslatedContainer.innerHTML = '<div class="empty-msg">기록된 미번역 텍스트가 없습니다.</div>';
      return;
    }
    list.forEach(txt => {
      const item = document.createElement('div');
      item.className = 'list-item';
      item.textContent = txt;
      untranslatedContainer.appendChild(item);
    });
  }

  function updateDictUI(applied, fileName = '') {
    isDictApplied = applied;
    if (applied) {
      dictDesc.textContent = `적용됨: ${fileName}`;
      dictDesc.style.color = '#1a73e8';
      btnImport.textContent = '해제';
      btnImport.className = 'btn btn-secondary';
    } else {
      dictDesc.textContent = defaultDictDesc;
      dictDesc.style.color = 'var(--text-muted)';
      btnImport.textContent = '가져오기';
      btnImport.className = 'btn';
      fileInput.value = '';
    }
  }

  extActive.addEventListener('change', () => {
    chrome.storage.local.set({ extActive: extActive.checked });
    toggleSection(mainSettings, extActive.checked);
  });

  displayMode.addEventListener('change', () => {
    chrome.storage.local.set({ displayMode: displayMode.value });
  });

  fontFamily.addEventListener('change', () => {
    chrome.storage.local.set({ fontFamily: fontFamily.value });
  });

  typingEffect.addEventListener('change', () => {
    chrome.storage.local.set({ typingEffect: typingEffect.checked });
  });

  googleTranslate.addEventListener('change', () => {
    chrome.storage.local.set({ googleTranslate: googleTranslate.checked });
  });

  recordUntranslated.addEventListener('change', () => {
    chrome.storage.local.set({ recordUntranslated: recordUntranslated.checked });
    toggleSection(recordSubSettings, recordUntranslated.checked);
  });

  btnClear.addEventListener('click', () => {
    chrome.storage.local.get({ untranslatedList: [] }, (items) => {
      if (items.untranslatedList.length === 0) {
        alert('삭제할 텍스트가 없습니다.');
        return;
      }
      if (confirm('기록된 미번역 텍스트를 모두 삭제하시겠습니까?')) {
        chrome.storage.local.set({ untranslatedList: [] }, () => {
          renderUntranslated([]);
        });
      }
    });
  });

  btnImport.addEventListener('click', () => {
    if (isDictApplied) {

      if (confirm('적용된 커스텀 사전을 해제하시겠습니까?')) {
        chrome.storage.local.remove(['customDict', 'customDictName'], () => {
          updateDictUI(false);
          alert('커스텀 사전 적용이 해제되었습니다.');
        });
      }
    } else {

      fileInput.click();
    }
  });

  fileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const customDict = JSON.parse(evt.target.result);

        chrome.storage.local.set({
          customDict: customDict,
          customDictName: file.name
        }, () => {
          updateDictUI(true, file.name);
          alert('커스텀 사전이 성공적으로 적용되었습니다!');
        });
      } catch (err) {
        alert('올바른 JSON 파일이 아닙니다. 파일을 확인해주세요.');
        fileInput.value = '';
      }
    };
    reader.readAsText(file);
  });

  btnGithub.addEventListener('click', () => {
    chrome.storage.local.get({ untranslatedList: [] }, (items) => {
      const list = items.untranslatedList;
      if (!list || list.length === 0) {
        alert('제보할 미번역 텍스트가 없습니다.');
        return;
      }

      const issueTitle = encodeURIComponent('Untranslated text');
      let issueContent = ``;
      list.forEach(txt => {
        issueContent += `"${txt}",\n`;
      });

      const issueBody = encodeURIComponent(issueContent);
      const githubUrl = `https://github.com/YounJason/Chess.com-Korean-Review/issues/new?title=${issueTitle}&body=${issueBody}`;
      window.open(githubUrl, '_blank');
    });
  });

  const slideData = [
    { imgSrc: "images/welcome.png", text: "설치해 주셔서 감사합니다! 이제 체스닷컴의 게임 리뷰 코치 피드백과 퍼즐 안내 문구가 자동으로 자연스러운 한국어로 번역됩니다." },
    { imgSrc: "images/option.png", text: "설정을 변경하려면 언제든지 확장 프로그램의 '옵션'을 클릭하세요." }
  ];
  let currentIndex = 0;

  if (window.location.hash === '#welcome') {
    const modal = document.getElementById('welcomeModal');
    const img = document.getElementById('modalImage');
    const desc = document.getElementById('modalDescription');
    const nextBtn = document.getElementById('nextBtn');

    const updateSlide = () => {
      const isLast = currentIndex === slideData.length - 1;
      img.src = slideData[currentIndex].imgSrc;
      desc.textContent = slideData[currentIndex].text;

      nextBtn.textContent = isLast ? '닫기' : '다음';
      nextBtn.classList.toggle('close-mode', isLast);
    };

    modal.style.display = 'flex';
    updateSlide();

    nextBtn.addEventListener('click', () => {
      if (currentIndex === slideData.length - 1) {
        modal.style.display = 'none';
        window.location.hash = '';
      } else {
        currentIndex++;
        updateSlide();
      }
    });
  }
});