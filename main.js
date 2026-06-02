(function() {
    function save(txt) {
        let list = [];
        try {
            list = JSON.parse(localStorage.getItem('extension_untranslated')) || [];
        } catch (e) {}
        if (!list.includes(txt) && !/[ㄱ-ㅎㅏ-ㅣ가-힣]/.test(txt)) {
            list.push(txt);
            localStorage.setItem('extension_untranslated', JSON.stringify(list));
        }
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
        const styleAttr = el.getAttribute('style') || '';
        const match = styleAttr.match(/--tw-visible\s*:\s*(\d+)/);
        if (match) {
            const origVisible = parseInt(match[1], 10);
            const cloneVisible = el._origLen ? Math.round((origVisible / el._origLen) * el._transLen) : 0;
            el._clone.style.setProperty('--tw-visible', cloneVisible);
        }
    }

    function processElement(el) {
        const origText = parseSpeechElement(el);
        if (!origText) return;
        if (!el._clone || el._clone.dataset.origText !== origText) {
            if (el._clone) {
                el._clone.remove();
                el._clone = null;
            }

            console.log(origText);

            const translated = dict[origText];
            if (!translated) {
                save(origText);
                el.style.display = '';
                return;
            }

            const origLen = origText.replace(/\[\[|\]\]/g, '').length;
            const transLen = translated.replace(/\[\[|\]\]/g, '').length;

            const kwEl = el.querySelector('.move-feedback-speech-text-keyword-fade-in');
            const kwClass = kwEl ? kwEl.className : '';

            const clone = el.cloneNode(false);
            clone.setAttribute('trans', 'true');
            clone.style.display = '';
            clone.dataset.origText = origText;
            
            buildCloneDOM(clone, translated, kwClass);

            el.after(clone);
            el.style.display = 'none';

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
        }

        syncVisibility(el);
    }

    const globalObserver = new MutationObserver((mutations) => {
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

    globalObserver.observe(document.body, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['style', 'class'],
        characterData: true,
        characterDataOldValue: true
    });
})();