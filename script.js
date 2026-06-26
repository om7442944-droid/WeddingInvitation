document.addEventListener('DOMContentLoaded', () => {
  // عناصر الواجهة
  const envelope = document.getElementById('envelope');
  const envelopeCard = document.querySelector('.envelope-card');
  const invitation = document.getElementById('invitation');
  const timer = document.getElementById('timer');
  const openCircleBtn = document.getElementById('openCircleBtn');

  // تأكد أن الدعوة مخفية في البداية (تعتمد على CSS .show)
  if (invitation) invitation.classList.remove('show');

  if (!envelope || !envelopeCard || !invitation) {
    console.warn('العناصر المطلوبة لشاشة الفتح غير موجودة.');
    return;
  }

  // تأثير بصري سريع عند الضغط على البطاقة
  envelopeCard.addEventListener('mousedown', () => envelopeCard.classList.add('popping'));
  ['mouseup', 'mouseleave', 'blur'].forEach(ev =>
    envelopeCard.addEventListener(ev, () => envelopeCard.classList.remove('popping'))
  );

  // فتح الظرف عند النقر أو الضغط على Enter
  function openEnvelope() {
    envelopeCard.classList.add('opening');
    envelopeCard.setAttribute('aria-hidden', 'true');
    setTimeout(() => {
      envelope.style.display = 'none';
      invitation.classList.add('show');
      try { invitation.scrollIntoView({ behavior: 'smooth' }); } catch (e) {}
    }, 1000);
  }

  envelopeCard.addEventListener('click', openEnvelope);
  envelopeCard.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') openEnvelope(); });
  if (openCircleBtn) openCircleBtn.addEventListener('click', (e) => { e.stopPropagation(); openEnvelope(); });

  // عدّاد تنازلي
  const weddingDate = new Date('August 3, 2026 20:00:00').getTime();
  function pad(n){ return String(n).padStart(2,'0'); }

  function renderGroup(container, value, label, cls){
    const group = document.createElement('div');
    group.className = 'time-group ' + (cls || '');
    const digits = String(value).split('');
    const digitsWrap = document.createElement('div');
    digitsWrap.className = 'digits';
    for(const ch of digits){
      const span = document.createElement('span');
      span.className = 'count-char';
      span.textContent = ch;
      digitsWrap.appendChild(span);
    }
    group.appendChild(digitsWrap);
    const lbl = document.createElement('div');
    lbl.className = 'time-label';
    lbl.textContent = label;
    group.appendChild(lbl);
    container.appendChild(group);
  }

  function updateTimer() {
    const now = Date.now();
    const distance = weddingDate - now;
    if (distance <= 0) {
      timer.innerHTML = 'الفرح بدأ 🎉';
      clearInterval(countdownInterval);
      return;
    }
    const days = Math.floor(distance / (1000 * 60 * 60 * 24));
    const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((distance % (1000 * 60)) / 1000);

    timer.innerHTML = '';
    renderGroup(timer, pad(days), 'يوم', 'days');
    renderGroup(timer, pad(hours), 'ساعة', 'hours');
    renderGroup(timer, pad(minutes), 'دقيقة', 'minutes');
    renderGroup(timer, pad(seconds), 'ثانية', 'seconds');
  }

  updateTimer();
  const countdownInterval = setInterval(updateTimer, 1000);
});
