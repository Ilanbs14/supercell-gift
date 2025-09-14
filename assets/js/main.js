document.addEventListener('DOMContentLoaded', function () {
  const cards = document.querySelectorAll('.card-voucher');

  // debounce utilitaire
  function debounce(fn, wait = 120) {
    let t;
    return (...args) => {
      clearTimeout(t);
      t = setTimeout(() => fn(...args), wait);
    };
  }

  // génère le QR dans l'élément qrWrap en tenant compte de la taille CSS effective
  function generateQRCode(qrWrap, url) {
    if (!qrWrap) return;
    // supprime ancien QR
    qrWrap.innerHTML = '';
    const style = getComputedStyle(qrWrap);
    const width = parseInt(style.width, 10) || 160;
    const height = parseInt(style.height, 10) || width;
    try {
      new QRCode(qrWrap, {
        text: url,
        width: width,
        height: height,
        colorDark : "#000000",
        colorLight : "#ffffff",
        correctLevel : QRCode.CorrectLevel.H
      });
    } catch (err) {
      // fallback texte en cas d'erreur
      qrWrap.textContent = 'QR erreur';
      console.error('QRCode gen failed', err);
    }
  }

  cards.forEach(card => {
    const clickLinkA = card.querySelector('.click-link a');
    const qrWrap = card.querySelector('.qr-wrap');
    const openBtn = card.querySelector('.open-link');
    const copyBtn = card.querySelector('.copy-link-btn');
    const expiryText = card.querySelector('.expiry-text');

    const url = clickLinkA ? clickLinkA.href.trim() : null;

    // --- QR: génération initiale à bonne taille ---
    if (url && qrWrap) {
      generateQRCode(qrWrap, url);
    } else if (qrWrap) {
      qrWrap.textContent = 'Pas de lien';
    }

    // --- Observe la taille du wrapper QR et regénère si change (responsive) ---
    if (qrWrap && typeof ResizeObserver !== 'undefined') {
      const ro = new ResizeObserver(debounce(entries => {
        for (const e of entries) {
          // si la taille a changé, regénère
          if (url) generateQRCode(qrWrap, url);
        }
      }, 120));
      ro.observe(qrWrap);
      // stocke l'observer sur l'élément si besoin de l'arrêter plus tard
      qrWrap._qrResizeObserver = ro;
    } else {
      // fallback : regénérer au resize window (moins précis)
      window.addEventListener('resize', debounce(() => {
        if (url && qrWrap) generateQRCode(qrWrap, url);
      }, 180));
    }

    // --- Lien ouvrir (met href si existe) et copy-on-open si demandé ---
    if (openBtn) {
      if (url) {
        openBtn.href = url;
        openBtn.addEventListener('click', async function(ev) {
          if (card.classList.contains('expired')) {
            ev.preventDefault();
            return;
          }
          const copyWord = card.dataset.copyWord;
          const wantsCopyOnOpen = card.classList.contains('copy-on-open') || !!copyWord;
          if (!wantsCopyOnOpen) return; // laisse le lien s'ouvrir normalement
          ev.preventDefault();
          const textToCopy = copyWord || url;
          try {
            await navigator.clipboard.writeText(textToCopy);
            const original = openBtn.innerHTML;
            openBtn.textContent = 'Copié ✓';
            window.open(url, '_blank', 'noopener');
            setTimeout(() => { openBtn.innerHTML = original; }, 900);
          } catch (err) {
            console.warn('Copie échouée :', err);
            window.open(url, '_blank', 'noopener');
          }
        });
      } else {
        openBtn.setAttribute('aria-disabled', 'true');
        openBtn.removeAttribute('href');
      }
    }

    // --- Copy bouton ---
    if (copyBtn) {
      copyBtn.addEventListener('click', async (ev) => {
        ev.preventDefault();
        if (!url) return;
        try {
          await navigator.clipboard.writeText(url);
          const original = copyBtn.innerHTML;
          copyBtn.textContent = 'Copié ✓';
          setTimeout(() => { copyBtn.innerHTML = original; }, 1400);
        } catch (err) {
          const original = copyBtn.innerHTML;
          copyBtn.textContent = 'Erreur';
          setTimeout(() => { copyBtn.innerHTML = original; }, 1400);
        }
      });
    }

    // --- Gestion expiration ---
    const expiryAttr = card.dataset.expiry;
    if (expiryAttr) {
      const expiryDate = new Date(expiryAttr + 'T23:59:59');
      const now = new Date();
      const msPerDay = 24*60*60*1000;
      const diffDays = Math.ceil((expiryDate - now) / msPerDay);
      const formatDateFr = (d) => new Intl.DateTimeFormat('fr-FR', { year:'numeric', month:'2-digit', day:'2-digit' }).format(d);

      if (diffDays > 0) {
        expiryText.textContent = `Expirera le ${formatDateFr(expiryDate)} (${diffDays} jour${diffDays>1?'s':''} restants)`;
      } else if (diffDays === 0) {
        expiryText.textContent = `Expire aujourd'hui (${formatDateFr(expiryDate)})`;
      } else {
        const daysSince = Math.abs(diffDays);
        expiryText.textContent = `Expiré le ${formatDateFr(expiryDate)} (il y a ${daysSince} jour${daysSince>1?'s':''})`;
        card.classList.add('expired');
        if (openBtn) { openBtn.removeAttribute('href'); openBtn.setAttribute('aria-disabled', 'true'); }
        if (copyBtn) { copyBtn.disabled = true; copyBtn.setAttribute('aria-disabled', 'true'); }
      }
    } else {
      expiryText.textContent = 'Aucune date d’expiration définie';
    }
  });
});
