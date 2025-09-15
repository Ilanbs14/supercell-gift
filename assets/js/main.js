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

    if (url && qrWrap) {
      generateQRCode(qrWrap, url);
    } else if (qrWrap) {
      qrWrap.textContent = 'Pas de lien';
    }

    if (qrWrap && typeof ResizeObserver !== 'undefined') {
      const ro = new ResizeObserver(debounce(entries => {
        for (const e of entries) {
          if (url) generateQRCode(qrWrap, url);
        }
      }, 120));
      ro.observe(qrWrap);
      qrWrap._qrResizeObserver = ro;
    } else {
      window.addEventListener('resize', debounce(() => {
        if (url && qrWrap) generateQRCode(qrWrap, url);
      }, 180));
    }

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
          if (!wantsCopyOnOpen) return;
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

    // --- Gestion expiration avancée ---
    const expiryAttr = card.dataset.expiry;
    if (expiryAttr) {
      // Date d'expiration à 23:59:59 du jour donné
      const expiryDate = new Date(expiryAttr + 'T23:59:59');
      const now = new Date();

      const msPerDay = 24*60*60*1000;
      const msToExpiry = expiryDate - now;

      // Calcul du début de la journée d'expiration (minuit)
      const expiryDayStart = new Date(expiryDate);
      expiryDayStart.setHours(0,0,0,0);

      // Formatage date FR
      const formatDateFr = (d) => new Intl.DateTimeFormat('fr-FR', { year:'numeric', month:'2-digit', day:'2-digit' }).format(d);

      if (msToExpiry < 0) {
        // Déjà expiré (passé minuit du jour d'expiration)
        expiryText.textContent = `Expiré le ${formatDateFr(expiryDate)}`;
        card.classList.add('expired');
        if (openBtn) { openBtn.removeAttribute('href'); openBtn.setAttribute('aria-disabled', 'true'); }
        if (copyBtn) { copyBtn.disabled = true; copyBtn.setAttribute('aria-disabled', 'true'); }
      } else if (msToExpiry <= 24*60*60*1000) {
        // Dans les dernières 24h avant expiration
        const hoursLeft = Math.floor(msToExpiry / (60*60*1000));
        const minutesLeft = Math.floor((msToExpiry % (60*60*1000)) / (60*1000));
        expiryText.textContent = `Expire dans ${hoursLeft} heure${hoursLeft>1?'s':''} et ${minutesLeft} minute${minutesLeft>1?'s':''}`;
      } else {
        // Expire plus tard, afficher la date complète et jours restants
        const diffDays = Math.ceil(msToExpiry / msPerDay);
        expiryText.textContent = `Expirera le ${formatDateFr(expiryDate)} (${diffDays} jour${diffDays>1?'s':''} restants)`;
      }
    } else {
      expiryText.textContent = 'Aucune date d’expiration définie';
    }
  });
});
