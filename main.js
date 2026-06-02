(function () {
    let settings = {
        extActive: true,
        displayMode: 'ko-only',
        fontFamily: 'system',
        typingEffect: true,
        googleTranslate: false,
        recordUntranslated: true,
        customDict: {}
    };
    let fullDict = {};

    function updateFullDict() {
        const baseDict = typeof Dict !== 'undefined' ? Dict : {};
        fullDict = Object.assign({}, baseDict, settings.customDict);
    }

    function save(txt) {
        if (!settings.recordUntranslated) return;
        chrome.storage.local.get({ untranslatedList: [] }, (items) => {
            let list = items.untranslatedList;
            if (!list.includes(txt) && !/[ㄱ-ㅎㅏ-ㅣ가-힣]/.test(txt)) {
                list.push(txt);
                chrome.storage.local.set({ untranslatedList: list });
            }
        });
    }

    function injectFont(fontName) {
        let styleEl = document.getElementById('chess-ko-font-style');
        if (!styleEl) {
            styleEl = document.createElement('style');
            styleEl.id = 'chess-ko-font-style';
            document.head.appendChild(styleEl);
        }

        let linkEl = document.getElementById('chess-ko-font-link');
        if (linkEl) linkEl.remove();

        if (fontName === 'system') {
            styleEl.textContent = `[trans="true"] { font-family: inherit !important; }`;
            return;
        }

        linkEl = document.createElement('link');
        linkEl.id = 'chess-ko-font-link';
        linkEl.rel = 'stylesheet';
        linkEl.href = `https://fonts.googleapis.com/css2?family=${fontName}&display=swap`;
        document.head.appendChild(linkEl);

        const realFontName = fontName.replace(/\+/g, ' ');
        styleEl.textContent = `[trans="true"] { font-family: '${realFontName}', sans-serif !important; }`;
    }

    function parseSpeechElement(el) {
        let origText = "";
        for (let child of el.childNodes) {
            if (child.nodeType === Node.ELEMENT_NODE) {
                if (child.classList.contains('move-feedback-speech-text-keyword-fade-in')) {
                    let kwText = "";
                    for (let gChild of child.childNodes) {
                        kwText += gChild.textContent;
                    }
                    origText += `[[${kwText}]]`;
                } else {
                    origText += child.textContent;
                }
            } else if (child.nodeType === Node.TEXT_NODE) {
                origText += child.textContent;
            }
        }
        return origText.trim();
    }

    function buildCloneDOM(cloneEl, translatedText, keywordClass) {
        cloneEl.innerHTML = "";
        let globalIdx = 0;
        const parts = translatedText.split(/(\[\[.*?\]\])/);

        parts.forEach(part => {
            if (part.startsWith('[[') && part.endsWith(']]')) {
                const kwText = part.slice(2, -2);
                const kwSpan = document.createElement('span');
                kwSpan.className = keywordClass || 'move-feedback-speech-text-keyword-fade-in';
                kwSpan.style.setProperty('--tw-i', globalIdx);

                for (let char of kwText) {
                    const charSpan = document.createElement('span');
                    charSpan.textContent = char;
                    charSpan.style.setProperty('--tw-i', globalIdx++);
                    kwSpan.appendChild(charSpan);
                }
                cloneEl.appendChild(kwSpan);
            } else {
                for (let char of part) {
                    const charSpan = document.createElement('span');
                    charSpan.textContent = char;
                    charSpan.style.setProperty('--tw-i', globalIdx++);
                    cloneEl.appendChild(charSpan);
                }
            }
        });
    }

    function syncVisibility(el) {
        if (!el._clone || !el._origLen || !el._transLen) return;

        if (!settings.typingEffect) {
            el._clone.style.setProperty('--tw-visible', el._transLen);
            return;
        }

        const styleAttr = el.getAttribute('style') || '';
        const match = styleAttr.match(/--tw-visible\s*:\s*(\d+)/);
        if (match) {
            const origVisible = parseInt(match[1], 10);
            const cloneVisible = el._origLen ? Math.round((origVisible / el._origLen) * el._transLen) : 0;
            el._clone.style.setProperty('--tw-visible', cloneVisible);
        }
    }

    function renderClone(el, origText, translated) {
        if (el._clone && typeof el._clone.remove === 'function') {
            el._clone.remove();
        }

        const origLen = origText.replace(/\[\[|\]\]/g, '').length;
        const transLen = translated.replace(/\[\[|\]\]/g, '').length;
        const kwEl = el.querySelector('.move-feedback-speech-text-keyword-fade-in');
        const kwClass = kwEl ? kwEl.className : '';

        const clone = el.cloneNode(false);
        clone.setAttribute('trans', 'true');
        clone.dataset.origText = origText;

        buildCloneDOM(clone, translated, kwClass);
        el.after(clone);

        if (settings.displayMode === 'both') {
            el.style.display = '';
            clone.style.display = 'block';
            clone.style.marginTop = '6px';
            clone.style.borderTop = '1px dashed #dadce0';
            clone.style.paddingTop = '4px';
        } else {
            el.style.display = 'none';
            clone.style.display = '';
        }

        clone._orig = el;
        el._clone = clone;
        el._origLen = origLen;
        el._transLen = transLen;

        const cloneKw = clone.querySelector('.move-feedback-speech-text-keyword-fade-in');
        if (kwEl && cloneKw) {
            cloneKw.addEventListener('click', (e) => {
                e.stopPropagation();
                kwEl.click();
            });

            if (el._kwObserver) el._kwObserver.disconnect();
            const kwObserver = new MutationObserver((mutations) => {
                for (let m of mutations) {
                    if (m.attributeName === 'class') {
                        cloneKw.className = kwEl.className;
                    }
                }
            });
            kwObserver.observe(kwEl, { attributes: true, attributeFilter: ['class'] });
            el._kwObserver = kwObserver;
        }
        syncVisibility(el);
    }

    function processElement(el) {
        if (!settings.extActive) return;

        const origText = parseSpeechElement(el);
        if (!origText) return;

        if (!el._clone || el._clone.dataset.origText !== origText) {
            if (el._clone) {
                el._clone.remove();
                el._clone = null;
            }

            const translated = fullDict[origText];
            if (!translated) {
                save(origText);

                if (settings.googleTranslate) {
                    el._clone = { dataset: { origText: origText }, remove: () => { } };
                    const cleanText = origText.replace(/\[\[|\]\]/g, '');
                    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=ko&dt=t&q=${encodeURIComponent(cleanText)}`;

                    fetch(url)
                        .then(res => res.json())
                        .then(data => {
                            if (data && data[0] && data[0][0] && data[0][0][0]) {
                                const gTranslated = data[0][0][0];
                                if (parseSpeechElement(el) === origText) {
                                    renderClone(el, origText, gTranslated);
                                }
                            }
                        })
                        .catch(err => {
                            console.error("Google Translate Error:", err);
                            el._clone = null;
                            el.style.display = '';
                        });
                } else {
                    el.style.display = '';
                }
                return;
            }

            renderClone(el, origText, translated);
        }
        syncVisibility(el);
    }

    const globalObserver = new MutationObserver((mutations) => {
        if (!settings.extActive) return;

        document.querySelectorAll('[trans="true"]').forEach(clone => {
            if (!clone._orig || !document.body.contains(clone._orig)) {
                clone.remove();
            }
        });

        const targets = document.querySelectorAll('.typewriter-text-tw:not([trans]), .move-feedback-speech-text-tw:not([trans])');
        targets.forEach(el => {
            processElement(el);
        });

        for (let m of mutations) {
            let target = m.target;

            if (m.type === 'characterData') {
                if (target.nodeType === Node.TEXT_NODE) target = target.parentNode;
                if (target && target.closest) {
                    const bubble = target.closest('.typewriter-text-tw:not([trans]), .move-feedback-speech-text-tw:not([trans])');
                    if (bubble) processElement(bubble);
                }
            } else if (m.type === 'attributes' && m.attributeName === 'style') {
                if (target.classList && (target.classList.contains('typewriter-text-tw') || target.classList.contains('move-feedback-speech-text-tw')) && !target.hasAttribute('trans')) {
                    syncVisibility(target);
                }
            }
        }
    });


    chrome.storage.local.get(settings, (items) => {
        Object.assign(settings, items);
        updateFullDict();
        injectFont(settings.fontFamily);

        globalObserver.observe(document.body, {
            childList: true,
            subtree: true,
            attributes: true,
            attributeFilter: ['style', 'class'],
            characterData: true,
            characterDataOldValue: true
        });
    });

    chrome.storage.onChanged.addListener((changes, area) => {
        if (area === 'local') {
            for (let key in changes) {
                settings[key] = changes[key].newValue;
            }
            if (changes.customDict) updateFullDict();
            if (changes.fontFamily) injectFont(settings.fontFamily);

            if (changes.extActive) {
                if (!settings.extActive) {
                    document.querySelectorAll('[trans="true"]').forEach(clone => {
                        if (clone._orig) clone._orig.style.display = '';
                        clone.remove();
                    });
                } else {
                    document.querySelectorAll('.typewriter-text-tw, .move-feedback-speech-text-tw').forEach(el => {
                        if (!el.hasAttribute('trans')) processElement(el);
                    });
                }
            }

            if (changes.displayMode || changes.typingEffect) {
                document.querySelectorAll('.typewriter-text-tw:not([trans]), .move-feedback-speech-text-tw:not([trans])').forEach(el => {
                    if (el._clone) {
                        el._clone.dataset.origText = "";
                        processElement(el);
                    }
                });
            }
        }
    });
})();