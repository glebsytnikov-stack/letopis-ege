(() => {
  'use strict';
  const CARDS = window.CARDS || [];
  const MAP_TASKS = window.MAP_TASKS || [];
  const TYPE_NAMES = {dates:'Даты и события',terms:'Исторические термины',rulers:'Правители и деятели',events:'Войны и процессы',culture:'Культура и памятники'};
  const TYPE_ICONS = {dates:'◷',terms:'❖',rulers:'♛',events:'⚔',culture:'▧'};
  const STORE_KEY = 'letopis.ege.v1';
  const freshState = () => ({known:[],hard:[],favorites:[],xp:0,streak:0,lastVisit:'',quizDone:0,correct:0,answered:0});
  let state = loadState();
  let currentFilter = 'all';
  let visibleCards = CARDS.slice();
  let cardIndex = 0;
  let trainerMode = 'quiz';
  let quiz = null;
  let currentMap = 0;
  let mapAttempt = null;
  let toastTimer = null;
  const $ = (sel, root=document) => root.querySelector(sel);
  const $$ = (sel, root=document) => [...root.querySelectorAll(sel)];
  const shuffle = arr => [...arr].sort(() => Math.random() - .5);
  const pick = (arr, n) => shuffle(arr).slice(0, n);
  const escapeHtml = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

  function loadState(){
    try {
      const stored = JSON.parse(localStorage.getItem(STORE_KEY) || 'null');
      return stored ? {...freshState(), ...stored} : freshState();
    } catch { return freshState(); }
  }
  function saveState(){
    try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); }
    catch { showToast('Не удалось сохранить данные в этом браузере.'); }
  }
  function updateVisit(){
    const today = new Date().toLocaleDateString('en-CA');
    if (state.lastVisit !== today) {
      const yesterday = new Date(Date.now() - 86400000).toLocaleDateString('en-CA');
      state.streak = state.lastVisit === yesterday ? state.streak + 1 : 1;
      state.lastVisit = today;
      saveState();
    }
  }
  function showToast(message){
    const el = $('#toast'); if(!el) return;
    el.textContent = message; el.classList.add('show');
    clearTimeout(toastTimer); toastTimer = setTimeout(() => el.classList.remove('show'), 2200);
  }
  function navigate(page){
    $$('.page').forEach(p => p.classList.toggle('active', p.id === `page-${page}`));
    $$('.nav-item').forEach(n => n.classList.toggle('active', n.dataset.page === page));
    const titles = {home:'Главная',cards:'Карточки',trainer:'Тренажёр',maps:'Карты и схемы',progress:'Мой прогресс'};
    $('#crumb-title').textContent = titles[page] || 'Главная';
    $('#sidebar').classList.remove('open');
    if(page==='cards') renderStudy();
    if(page==='progress') renderProgress();
    if(page==='maps' && !mapAttempt) renderMap(currentMap);
    window.scrollTo({top:0,behavior:'smooth'});
  }
  function typeCount(type){ return CARDS.filter(c=>c.type===type).length; }
  function renderHome(){
    $('#stat-known').textContent = state.known.length;
    $('#stat-total').textContent = CARDS.length;
    $('#stat-xp').textContent = state.xp;
    $('#stat-hard').textContent = state.hard.length;
    $('#stat-streak').textContent = state.streak;
    $('#streak-top').textContent = state.streak;
    $('#side-card-count').textContent = CARDS.length;
    $('#hard-subtitle').textContent = state.hard.length ? `${state.hard.length} карточек ждут повторения` : 'Пока нет карточек на повторение — так держать!';
    $('#cards-total-label').textContent = CARDS.length;
    Object.keys(TYPE_NAMES).forEach(type => {
      const el = $(`#count-${type}`); if(el) el.innerHTML = `${typeCount(type)} карт. <i>→</i>`;
    });
  }
  function setFilter(filter){
    currentFilter = filter; cardIndex=0;
    $$('.filter-tab').forEach(t=>t.classList.toggle('active',t.dataset.filter===filter));
    renderStudy();
  }
  function getFilteredCards(){
    let list = CARDS;
    if(currentFilter==='hard') list = CARDS.filter(c=>state.hard.includes(c.id));
    else if(currentFilter==='favorites') list = CARDS.filter(c=>state.favorites.includes(c.id));
    else if(currentFilter==='world') list = CARDS.filter(c=>c.era==='Всеобщая история');
    else if(currentFilter==='russia') list = CARDS.filter(c=>c.era!=='Всеобщая история');
    else if(currentFilter!=='all') list = CARDS.filter(c=>c.type===currentFilter);
    const term = ($('#card-search')?.value || '').trim().toLowerCase();
    if(term) list = list.filter(c => [c.front,c.back,c.hint,c.era,...(c.tags||[])].join(' ').toLowerCase().includes(term));
    return list;
  }
  function renderDeckList(){
    const deck = $('#study-deck-list');
    const entries = [
      ['all','✧','Все карточки',CARDS.length],
      ['russia','⌂','История России',CARDS.filter(c=>c.era!=='Всеобщая история').length],
      ['world','🌍','Всеобщая история',CARDS.filter(c=>c.era==='Всеобщая история').length],
      ...Object.keys(TYPE_NAMES).map(t=>[t,TYPE_ICONS[t],TYPE_NAMES[t],typeCount(t)]),
      ['hard','⚑','Сложные',state.hard.length],
      ['favorites','☆','Избранное',state.favorites.length]
    ];
    deck.innerHTML = entries.map(([key,icon,name,count]) => `<button class="study-deck-item ${currentFilter===key?'active':''}" data-study-filter="${key}"><span>${icon}</span><span>${escapeHtml(name)}</span><small>${count}</small></button>`).join('');
    $$('[data-study-filter]',deck).forEach(btn=>btn.addEventListener('click',()=>setFilter(btn.dataset.studyFilter)));
  }
  function renderStudy(){
    visibleCards = getFilteredCards();
    if(cardIndex >= visibleCards.length) cardIndex = Math.max(0,visibleCards.length-1);
    renderDeckList();
    const title = currentFilter==='all'?'ВСЕ КАРТОЧКИ':currentFilter==='hard'?'СЛОЖНЫЕ КАРТОЧКИ':currentFilter==='favorites'?'ИЗБРАННОЕ':currentFilter==='world'?'ВСЕОБЩАЯ ИСТОРИЯ':currentFilter==='russia'?'ИСТОРИЯ РОССИИ':TYPE_NAMES[currentFilter].toUpperCase();
    $('#study-category').textContent = title;
    $('#study-position').textContent = visibleCards.length ? `${cardIndex+1} / ${visibleCards.length}` : '0 / 0';
    const card = visibleCards[cardIndex];
    const flash = $('#flashcard');
    flash.classList.remove('flipped');
    if(!card){
      $('#flash-category').textContent='ПУСТАЯ КОЛОДА';
      $('#flash-front').textContent='Здесь пока нет карточек';
      $('#flash-back').textContent='Выбери другой раздел или добавь карточки в избранное.';
      $('#flash-hint').textContent=''; $('#card-tags').innerHTML='';
      $('#study-progress-fill').style.width='0%';
      $('#study-progress-text').textContent='Карточки не найдены';
      $('#card-favorite').textContent='☆';
      return;
    }
    $('#flash-category').textContent = `${TYPE_NAMES[card.type]} · ${card.era}`.toUpperCase();
    $('#flash-front').textContent = card.front;
    $('#flash-back').textContent = card.back;
    $('#flash-hint').textContent = card.hint || '';
    $('#card-tags').innerHTML = (card.tags||[]).map(t=>`<span class="tag">${escapeHtml(t)}</span>`).join('');
    $('#study-progress-fill').style.width = `${((cardIndex+1)/visibleCards.length)*100}%`;
    $('#study-progress-text').textContent = state.known.includes(card.id) ? 'Эта карточка отмечена как выученная' : 'Прочитай вопрос и вспомни ответ';
    $('#card-favorite').textContent = state.favorites.includes(card.id) ? '★' : '☆';
    $('#card-favorite').classList.toggle('selected',state.favorites.includes(card.id));
  }
  function currentCard(){ return visibleCards[cardIndex]; }
  function nextCard(){ if(visibleCards.length){cardIndex=(cardIndex+1)%visibleCards.length;renderStudy();} }
  function prevCard(){ if(visibleCards.length){cardIndex=(cardIndex-1+visibleCards.length)%visibleCards.length;renderStudy();} }
  function markKnown(){
    const card=currentCard(); if(!card) return;
    if(!state.known.includes(card.id)){state.known.push(card.id);state.xp+=5;showToast('+5 XP · Карточка выучена!');}
    state.hard=state.hard.filter(id=>id!==card.id);saveState();renderStudy();renderHome();nextCard();
  }
  function markHard(){
    const card=currentCard(); if(!card) return;
    if(!state.hard.includes(card.id)){state.hard.push(card.id);showToast('Добавлено в список повторения');}
    saveState();renderStudy();renderHome();nextCard();
  }
  function toggleFavorite(){
    const card=currentCard();if(!card)return;
    if(state.favorites.includes(card.id)){state.favorites=state.favorites.filter(id=>id!==card.id);showToast('Убрано из избранного');}
    else {state.favorites.push(card.id);showToast('Добавлено в избранное ☆');}
    saveState();renderStudy();renderHome();
  }
  function cardFromDeck(type){setFilter(type);navigate('cards');}
  function getYear(card){
    const s=card.front.replace(/\s/g,'');
    const match=s.match(/\d{3,4}/);
    return match ? Number(match[0]) : 99999;
  }
  const MODE_INFO = {
    quiz:{title:'Битва за дату',desc:'10 вопросов на знание ключевых событий и дат. За каждый правильный ответ получишь очки опыта.',source:'dates'},
    terms:{title:'Слово летописца',desc:'Проверь, насколько точно ты знаешь исторические понятия и умеешь отличать близкие определения.',source:'terms'},
    order:{title:'Хронолет',desc:'Восстанови хронологическую последовательность четырёх событий. Здесь важны не догадки, а точные даты.',source:'dates'},
    exam:{title:'Тренировка ЕГЭ‑2027',desc:'Короткая тренировка на исторические понятия и работу с точным определением. После теста повтори материал демоверсии ФИПИ.',source:'terms'}
  };
  function selectMode(mode){
    trainerMode=mode;quiz=null;
    $$('.mode-card').forEach(b=>b.classList.toggle('active',b.dataset.mode===mode));
    $('#trainer-title').textContent=MODE_INFO[mode].title;
    $('#trainer-description').textContent=MODE_INFO[mode].desc;
    $('#trainer-area').innerHTML=`<div class="trainer-start"><div class="trainer-emblem">${mode==='order'?'⌛':mode==='terms'?'❖':mode==='exam'?'▤':'⚔'}</div><div><div class="eyebrow">ГОТОВ К ИСПЫТАНИЮ?</div><h2>${MODE_INFO[mode].title}</h2><p>${MODE_INFO[mode].desc}</p><button class="btn btn-primary" id="start-trainer">Начать испытание <span>→</span></button></div></div>`;
    $('#start-trainer').addEventListener('click',startTrainer);
  }
  function startTrainer(){
    if(trainerMode==='order'){startOrderQuiz();return;}
    const source=CARDS.filter(c=>c.type===MODE_INFO[trainerMode].source);
    const questions=pick(source,Math.min(10,source.length));
    quiz={questions,index:0,correct:0,answered:false};
    renderQuizQuestion();
  }
  function buildOptions(card, source){
    const options=pick(source.filter(c=>c.id!==card.id),3).map(c=>c.back);
    return shuffle([card.back,...options]);
  }
  function renderQuizQuestion(){
    const q=quiz.questions[quiz.index]; if(!q){renderQuizResult();return;}
    quiz.answered=false;
    const pool=CARDS.filter(c=>c.type===q.type);
    const options=buildOptions(q,pool);
    quiz.currentAnswer=q.back;
    const prompt=trainerMode==='quiz' ? `Какое событие связано с датой «${q.front}»?` : trainerMode==='exam' ? `Какое понятие соответствует формулировке «${q.front}»?` : `Что означает историческое понятие «${q.front}»?`;
    $('#trainer-area').innerHTML=`<div class="quiz-box"><div class="quiz-top"><span>ВОПРОС ${quiz.index+1} ИЗ ${quiz.questions.length}</span><span>✦ ${quiz.correct} верно</span></div><div class="progress-track"><i style="width:${(quiz.index/quiz.questions.length)*100}%"></i></div><div class="quiz-question">${escapeHtml(prompt)}</div><div class="quiz-options">${options.map((o,i)=>`<button class="quiz-option" data-answer="${i}">${String.fromCharCode(1040+i)}. ${escapeHtml(o)}</button>`).join('')}</div><div id="quiz-feedback"></div><div class="quiz-footer"><span class="fine-print">Ответь сам, а потом прочитай пояснение.</span><button class="btn btn-primary" id="quiz-next" disabled>Дальше →</button></div></div>`;
    $$('.quiz-option').forEach((b,i)=>b.addEventListener('click',()=>answerQuiz(b,options[i],q)));
    $('#quiz-next').addEventListener('click',()=>{quiz.index++;renderQuizQuestion();});
  }
  function answerQuiz(button,answer,card){
    if(quiz.answered)return;
    quiz.answered=true;
    const correct=answer===quiz.currentAnswer;
    if(correct){quiz.correct++;state.correct++;state.xp+=3;showToast('+3 XP · Верно!');}
    state.answered++;saveState();
    $$('.quiz-option').forEach((b,i)=>{
      b.disabled=true;
      const text=b.textContent.slice(3).trim();
      if(text===quiz.currentAnswer)b.classList.add('correct');
    });
    if(!correct)button.classList.add('wrong');
    $('#quiz-feedback').innerHTML=`<div class="quiz-feedback"><b>${correct?'Верно!':'Почти, но нет.'}</b> ${escapeHtml(card.hint||card.back)}</div>`;
    $('#quiz-next').disabled=false;
    $('#quiz-next').textContent=quiz.index===quiz.questions.length-1?'Результат →':'Следующий вопрос →';
  }
  function renderQuizResult(){
    state.quizDone++;saveState();renderHome();
    const total=quiz.questions.length;const pct=Math.round(quiz.correct/total*100);
    $('#trainer-area').innerHTML=`<div class="quiz-result"><div class="result-medal">${pct>=80?'♛':pct>=50?'✦':'⚑'}</div><div class="eyebrow">ИСПЫТАНИЕ ЗАВЕРШЕНО</div><h2>${quiz.correct} из ${total} верных ответов</h2><p>${pct>=80?'Отличный результат! Ты уверенно держишь этот участок истории.':pct>=50?'Хорошая работа. Отметь сложные карточки и повтори их завтра.':'Не беда — летописец учится на каждом повторении. Вернись к карточкам и попробуй ещё раз.'}</p><p><b>+${quiz.correct*3} XP</b> получено за правильные ответы</p><button class="btn btn-primary" id="retry-quiz">Пройти ещё раз →</button></div>`;
    $('#retry-quiz').addEventListener('click',startTrainer);
  }
  function startOrderQuiz(){
    const byYear=new Map();
    CARDS.filter(c=>c.type==='dates' && getYear(c)<9999).forEach(card=>{const year=getYear(card);if(!byYear.has(year))byYear.set(year,card);});
    const events=pick([...byYear.values()],4).sort((a,b)=>getYear(a)-getYear(b));
    quiz={orderEvents:events,shuffled:shuffle(events),correct:0};
    const rows=quiz.shuffled.map((c,i)=>`<div class="order-row"><span>${String.fromCharCode(1040+i)}.</span><label>${escapeHtml(c.back)}</label><select data-order-id="${c.id}"><option value="">Позиция</option>${events.map((_,n)=>`<option value="${n+1}">${n+1}</option>`).join('')}</select></div>`).join('');
    $('#trainer-area').innerHTML=`<div class="quiz-box"><div class="quiz-top"><span>ХРОНОЛОГИЧЕСКОЕ ИСПЫТАНИЕ</span><span>4 события</span></div><h2 class="quiz-question">Расположи события от самого раннего к самому позднему</h2><div class="order-list">${rows}</div><div class="quiz-footer"><span class="fine-print">Каждому событию назначь уникальную позицию.</span><button class="btn btn-primary" id="check-order">Проверить →</button></div><div id="order-feedback"></div></div>`;
    $('#check-order').addEventListener('click',checkOrderQuiz);
  }
  function checkOrderQuiz(){
    const selects=$$('[data-order-id]');
    const vals=selects.map(s=>s.value);
    if(vals.some(v=>!v)||new Set(vals).size!==vals.length){showToast('Назначь каждому событию отдельное место.');return;}
    let right=0;
    selects.forEach(s=>{
      const card=quiz.shuffled.find(c=>c.id===s.dataset.orderId);
      const correct=quiz.orderEvents.findIndex(c=>c.id===card.id)+1;
      if(Number(s.value)===correct){right++;s.style.borderColor='#8eb28a';}else{s.style.borderColor='#cf9b8e';}
    });
    state.xp+=right*4;state.answered+=4;state.correct+=right;state.quizDone++;saveState();renderHome();
    $('#order-feedback').innerHTML=`<div class="quiz-feedback"><b>Результат: ${right} из 4.</b> Правильная последовательность: ${quiz.orderEvents.map(c=>`${c.front} — ${c.back}`).join(' → ')}. ${right===4?'Безупречно!':'Разбери даты и попробуй повторить.'}</div>`;
    $('#check-order').disabled=true;$('#check-order').textContent='Испытание завершено';
  }
  function renderMaps(){
    $('#map-list').innerHTML=MAP_TASKS.map((m,i)=>`<button class="map-pick ${i===currentMap?'active':''}" data-map="${i}"><span>МАРШРУТ 0${i+1}</span><b>${escapeHtml(m.title)}</b><small>${escapeHtml(m.period)}</small><i>→</i></button>`).join('');
    $$('[data-map]').forEach(b=>b.addEventListener('click',()=>{currentMap=Number(b.dataset.map);renderMaps();renderMap(currentMap);}));
  }
  function renderMap(index){
    const map=MAP_TASKS[index];if(!map)return;
    mapAttempt={items:shuffle(map.steps.map((text,i)=>({text,original:i}))),checked:false};
    const rows=mapAttempt.items.map((item,i)=>`<div class="order-row"><span>${String.fromCharCode(1040+i)}.</span><label>${escapeHtml(item.text)}</label><select data-map-order="${item.original}"><option value="">Позиция</option>${map.steps.map((_,n)=>`<option value="${n+1}">${n+1}</option>`).join('')}</select></div>`).join('');
    const nodes=map.steps.map((_,i)=>`<div class="route-node" style="left:${8+i*(84/Math.max(1,map.steps.length-1))}%">${i+1}<span>${i===0?'начало':i===map.steps.length-1?'итог':`этап ${i+1}`}</span></div>`).join('');
    $('#map-workspace').innerHTML=`<div class="map-work-head"><div><div class="eyebrow">ИСТОРИЧЕСКАЯ СХЕМА</div><h2>${escapeHtml(map.title)}</h2><p>${escapeHtml(map.intro)}</p></div><span class="map-period">${escapeHtml(map.period)}</span></div><div class="map-route-art"><div class="route-path"></div>${nodes}</div><p class="map-instruction">Назначь событиям правильную последовательность — от первого к последнему.</p><div class="order-list">${rows}</div><div class="map-check"><button class="btn btn-primary" id="check-map">Проверить маршрут →</button><button class="btn btn-quiet" id="reshuffle-map">Перемешать</button></div><div id="map-feedback"></div>`;
    $('#check-map').addEventListener('click',checkMap);
    $('#reshuffle-map').addEventListener('click',()=>renderMap(index));
  }
  function checkMap(){
    const selects=$$('[data-map-order]');const vals=selects.map(s=>s.value);
    if(vals.some(v=>!v)||new Set(vals).size!==vals.length){showToast('Назначь каждому событию отдельную позицию.');return;}
    let right=0;
    selects.forEach(s=>{
      const original=Number(s.dataset.mapOrder);const correct=MAP_TASKS[currentMap].order.indexOf(original)+1;
      if(Number(s.value)===correct){right++;s.style.borderColor='#8eb28a';}else{s.style.borderColor='#cf9b8e';}
    });
    const perfect=right===selects.length;
    if(perfect){state.xp+=10;saveState();renderHome();showToast('+10 XP · Маршрут пройден!');}
    $('#map-feedback').innerHTML=`<div class="map-feedback"><b>${right} из ${selects.length} верно.</b> ${escapeHtml(MAP_TASKS[currentMap].note)} ${perfect?'Маршрут восстановлен правильно!':'Проверь даты и попробуй ещё раз.'}</div>`;
    $('#check-map').disabled=true;$('#check-map').textContent='Проверено';
  }
  function renderProgress(){
    const known=state.known.length;const pct=Math.round(known/CARDS.length*100);
    $('#progress-percent').textContent=`${pct}%`;
    $('#progress-ring').style.background=`conic-gradient(#608767 ${pct*3.6}deg,#e8e3d5 ${pct*3.6}deg)`;
    $('#progress-title').textContent=pct>=80?'Знаток летописи':pct>=35?'Уверенно идёшь вперёд':known?'Первые знания уже закреплены':'Начни свой путь!';
    $('#progress-copy').textContent=known?`Ты выучил ${known} из ${CARDS.length} карточек. Продолжай повторение небольшими подходами.`:'Отмечай карточки, которые уже знаешь. Приложение сохранит прогресс на этом устройстве.';
    $('#progress-known').textContent=known;$('#progress-hard').textContent=state.hard.length;$('#progress-fav').textContent=state.favorites.length;$('#progress-xp').textContent=state.xp;
    $('#level-name').textContent=state.xp>=500?'Мудрец':state.xp>=200?'Книжник':state.xp>=50?'Подмастерье':'Ученик';$('#level-xp').textContent=`${state.xp} XP`;
    $('#category-progress-list').innerHTML=Object.keys(TYPE_NAMES).map(type=>{
      const total=typeCount(type);const count=CARDS.filter(c=>c.type===type&&state.known.includes(c.id)).length;const p=Math.round(count/total*100);
      return `<div class="category-row"><label>${TYPE_NAMES[type]}</label><div class="progress-track"><i style="width:${p}%"></i></div><b>${p}%</b></div>`;
    }).join('');
    const achievements=[
      ['✦','Первый шаг','Выучи первую карточку',known>=1],
      ['▤','Усердный ученик','Выучи 10 карточек',known>=10],
      ['♜','Знаток','Выучи 50 карточек',known>=50],
      ['♛','Летописец','Выучи 100 карточек',known>=100],
      ['🔥','Постоянство','Занимайся 3 дня подряд',state.streak>=3],
      ['⚔','Испытатель','Заверши 5 тренировок',state.quizDone>=5]
    ];
    $('#achievement-list').innerHTML=achievements.map(([icon,name,desc,won])=>`<div class="achievement ${won?'':'locked'}"><div class="achievement-icon">${icon}</div><div><b>${name}</b><small>${desc}</small></div>${won?'<span class="achievement-won">✓</span>':''}</div>`).join('');
  }
  function openModal(title,body,actions){
    $('#modal-content').innerHTML=`<h2>${title}</h2><p>${body}</p><div class="modal-actions">${actions}</div>`;
    $('#modal-backdrop').classList.add('open');
  }
  function closeModal(){ $('#modal-backdrop').classList.remove('open'); }
  function exportProgress(){
    const payload={app:'Летопись — ЕГЭ по истории',exportedAt:new Date().toISOString(),stats:{known:state.known.length,hard:state.hard.length,favorites:state.favorites.length,xp:state.xp,streak:state.streak},state};
    const blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='letopis-progress.json';a.click();URL.revokeObjectURL(url);showToast('Файл прогресса подготовлен.');
  }
  function bindEvents(){
    $$('.nav-item').forEach(b=>b.addEventListener('click',()=>navigate(b.dataset.page)));
    $$('[data-go]').forEach(b=>b.addEventListener('click',()=>navigate(b.dataset.go)));
    $$('[data-deck]').forEach(b=>b.addEventListener('click',()=>b.dataset.deck==='maps'?navigate('maps'):cardFromDeck(b.dataset.deck)));
    $('#mobile-menu').addEventListener('click',()=>$('#sidebar').classList.toggle('open'));
    $('#profile-button').addEventListener('click',()=>navigate('progress'));
    $('#flashcard').addEventListener('click',()=>$('#flashcard').classList.toggle('flipped'));
    $('#card-prev').addEventListener('click',prevCard);$('#card-next').addEventListener('click',nextCard);
    $('#mark-known').addEventListener('click',markKnown);$('#mark-hard').addEventListener('click',markHard);$('#card-favorite').addEventListener('click',toggleFavorite);
    $('#repeat-hard').addEventListener('click',()=>{setFilter('hard');navigate('cards');});
    $$('.filter-tab').forEach(b=>b.addEventListener('click',()=>setFilter(b.dataset.filter)));
    $('#card-search').addEventListener('input',()=>{cardIndex=0;renderStudy();});
    $$('.mode-card').forEach(b=>b.addEventListener('click',()=>selectMode(b.dataset.mode)));
    $('#start-trainer').addEventListener('click',startTrainer);
    $('#export-progress').addEventListener('click',exportProgress);
    $('#reset-progress').addEventListener('click',()=>openModal('Начать заново?','Все отметки о выученных, сложных и избранных карточках, очки опыта и серия занятий будут удалены с этого устройства. Это действие нельзя отменить.','<button class="btn btn-quiet" id="cancel-reset">Отмена</button><button class="btn btn-danger-quiet" id="confirm-reset">Сбросить</button>'));
    $('#modal-close').addEventListener('click',closeModal);$('#modal-backdrop').addEventListener('click',e=>{if(e.target.id==='modal-backdrop')closeModal();});
    document.addEventListener('click',e=>{
      if(e.target.id==='cancel-reset')closeModal();
      if(e.target.id==='confirm-reset'){state=freshState();saveState();closeModal();renderAll();renderProgress();renderStudy();showToast('Прогресс сброшен.');}
    });
    document.addEventListener('keydown',e=>{
      if(!$('#page-cards').classList.contains('active'))return;
      if(e.key==='ArrowRight')nextCard();if(e.key==='ArrowLeft')prevCard();if(e.key===' '&&e.target.tagName!=='INPUT'){e.preventDefault();$('#flashcard').classList.toggle('flipped');}
    });
  }
  function renderAll(){renderHome();renderStudy();renderMaps();renderProgress();}
  function initTelegram(){
    const tg=window.Telegram?.WebApp;
    if(!tg)return;
    try{tg.ready();tg.expand();tg.setHeaderColor('#f5efde');tg.setBackgroundColor('#f7f2e7');}catch(e){/* обычный браузер / старая версия клиента */}
  }
  function initPWA(){
    if('serviceWorker' in navigator && (location.protocol==='https:' || location.hostname==='localhost')){
      navigator.serviceWorker.register('./sw.js').catch(()=>{});
    }
    let promptEvent=null;
    window.addEventListener('beforeinstallprompt',e=>{
      e.preventDefault();promptEvent=e;
      const actions=$('.top-actions');
      if(actions && !$('#install-app')){
        const btn=document.createElement('button');btn.id='install-app';btn.className='btn btn-quiet';btn.style.padding='7px 10px';btn.style.fontSize='10px';btn.textContent='Установить';actions.prepend(btn);
        btn.addEventListener('click',async()=>{if(!promptEvent)return;promptEvent.prompt();await promptEvent.userChoice;promptEvent=null;btn.remove();});
      }
    });
    window.addEventListener('appinstalled',()=>showToast('Летопись установлена на устройство!'));
  }
  function init(){
    updateVisit();bindEvents();renderAll();initTelegram();initPWA();
    // Счётчики колод и главной обновляются при первом запуске.
    if(!localStorage.getItem('letopis.welcome')){showToast('Добро пожаловать в Летопись!');localStorage.setItem('letopis.welcome','1');}
  }
  document.addEventListener('DOMContentLoaded',init);
})();
