import { useEffect, useState, useRef } from 'react';

const tg = window.Telegram?.WebApp;
const API_URL = 'http://mybatok.bothost.ru:8000'; // замени на свой адрес

// Массив питомцев с условиями разблокировки
const PETS = [
  { id: 'dog', emoji: '🐶', name: 'Собачка', unlock: 'start' },
  { id: 'cat', emoji: '🐱', name: 'Кошка', unlock: 'start' },
  { id: 'rabbit', emoji: '🐰', name: 'Зайка', unlock: 'start' },
  { id: 'fox', emoji: '🦊', name: 'Лиса', unlock: 'level', level: 5 },
  { id: 'panda', emoji: '🐼', name: 'Панда', unlock: 'level', level: 10 },
  { id: 'koala', emoji: '🐨', name: 'Коала', unlock: 'level', level: 15 },
  { id: 'lion', emoji: '🦁', name: 'Лев', unlock: 'invite', invites: 3 },
  { id: 'unicorn', emoji: '🦄', name: 'Единорог', unlock: 'event' },
];

function App() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showShop, setShowShop] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showInviteMenu, setShowInviteMenu] = useState(false);
  const [activeProfileTab, setActiveProfileTab] = useState<'profile' | 'leaders' | 'pets'>('profile');
  const [isClicking, setIsClicking] = useState(false);
  const [floaters, setFloaters] = useState<Array<{ id: number; value: number; x: number; y: number }>>([]);
  const petRef = useRef<HTMLDivElement>(null);

  // Состояния профиля
  const [petName, setPetName] = useState<string>('Мой AI-питомец');
  const [isEditing, setIsEditing] = useState(false);
  const [tempName, setTempName] = useState(petName);
  const [userAvatar, setUserAvatar] = useState<string>('');

  // Состояние для лидеров
  const [leaders, setLeaders] = useState<any[]>([]);
  const [leadersLoading, setLeadersLoading] = useState(false);

  // Ивент (по выходным)
  const isEventActive = () => {
    const day = new Date().getDay();
    return day === 0 || day === 6;
  };
  const [eventActive, setEventActive] = useState(false);
  const [eventTimeLeft, setEventTimeLeft] = useState('');

  // Загрузка пользователя с сервера
  const loadUser = async () => {
    if (!tg) return;
    const userData = tg.initDataUnsafe?.user;
    if (!userData) return;

    try {
      const res = await fetch(`${API_URL}/user/${userData.id}`);
      if (!res.ok) throw new Error('Failed to load user');
      const data = await res.json();
      setUser(data);
      setUserAvatar(userData.first_name?.charAt(0).toUpperCase() || '?');
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  // Загрузка лидеров
  const loadLeaders = async () => {
    setLeadersLoading(true);
    try {
      const res = await fetch(`${API_URL}/leaders`);
      if (!res.ok) throw new Error('Failed to load leaders');
      const data = await res.json();
      setLeaders(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLeadersLoading(false);
    }
  };

  // Обновление пользователя на сервере
  const updateUser = async (updates: any) => {
    if (!user) return;
    try {
      await fetch(`${API_URL}/user/${user.user_id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });
      setUser((prev: any) => ({ ...prev, ...updates }));
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    if (tg) {
      tg.ready();
      tg.expand();
      loadUser();
    }
  }, []);

  useEffect(() => {
    setEventActive(isEventActive());
    if (isEventActive()) {
      const now = new Date();
      const end = new Date();
      end.setDate(end.getDate() + (7 - end.getDay()));
      end.setHours(23, 59, 59, 999);
      const diff = end.getTime() - now.getTime();
      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      setEventTimeLeft(`${hours}ч ${minutes}м`);
    }
  }, []);

  // При переключении на вкладку лидеров загружаем данные
  useEffect(() => {
    if (activeProfileTab === 'leaders') {
      loadLeaders();
    }
  }, [activeProfileTab]);

  // Трата голода: -15 в час
  useEffect(() => {
    const interval = setInterval(() => {
      setUser((prev: any) => {
        if (!prev) return prev;
        const newFood = Math.max(prev.food - 15, 0);
        updateUser({ food: newFood });
        return { ...prev, food: newFood };
      });
    }, 60 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  // Восстановление стамины
  useEffect(() => {
    const interval = setInterval(() => {
      setUser((prev: any) => {
        if (!prev) return prev;
        const newStamina = Math.min(prev.stamina + prev.stamina_regen_rate, prev.max_stamina);
        updateUser({ stamina: newStamina });
        return { ...prev, stamina: newStamina };
      });
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  // Удаление floaters
  useEffect(() => {
    if (floaters.length === 0) return;
    const timer = setTimeout(() => setFloaters([]), 1000);
    return () => clearTimeout(timer);
  }, [floaters]);

  // Порог опыта для уровня L
  const getThreshold = (lvl: number) => {
    if (lvl <= 8) {
      return 200 * lvl - 100;
    } else {
      return 300 * lvl - 900;
    }
  };

  let level = 1;
  while (user && getThreshold(level) <= user.total_clicks) {
    level++;
  }
  const prevThreshold = level === 1 ? 0 : getThreshold(level - 1);
  const nextThreshold = getThreshold(level);
  const expInCurrentLevel = user ? user.total_clicks - prevThreshold : 0;
  const expNeeded = nextThreshold - prevThreshold;
  const expPercent = user ? (expInCurrentLevel / expNeeded) * 100 : 0;

  // Функция проверки разблокировки питомца
  const isPetUnlocked = (pet: typeof PETS[0]) => {
    if (!user) return false;
    if (pet.unlock === 'start') return true;
    if (pet.unlock === 'level') return level >= (pet.level ?? 0);
    if (pet.unlock === 'invite') return user.friends_count >= (pet.invites ?? 0);
    if (pet.unlock === 'event') return eventActive;
    return false;
  };

  const currentPet = PETS.find(p => p.id === (user?.selected_pet || 'dog')) || PETS[0];
  const currentPetEmoji = currentPet.emoji;

  const sendAction = (action: string, payload: any = {}) => {
    if (tg) tg.sendData(JSON.stringify({ action, ...payload }));
  };

  const handleClick = async () => {
    if (!user) return;
    if (user.stamina < 1) {
      alert('Нет сил! Подожди, энергия восстановится.');
      return;
    }

    setIsClicking(true);
    setTimeout(() => setIsClicking(false), 100);

    const reward = eventActive ? user.click_power * 2 : user.click_power;
    const newGems = user.gems + reward;
    const newStamina = user.stamina - 1;
    const newTotalClicks = user.total_clicks + 1;

    setUser((prev: any) => ({
      ...prev,
      gems: newGems,
      stamina: newStamina,
      total_clicks: newTotalClicks,
    }));

    await updateUser({
      gems: newGems,
      stamina: newStamina,
      total_clicks: newTotalClicks,
    });

    if (petRef.current) {
      const rect = petRef.current.getBoundingClientRect();
      const x = Math.random() * rect.width * 0.8 + rect.width * 0.1;
      const y = Math.random() * rect.height * 0.5 + rect.height * 0.2;
      setFloaters(prev => [...prev, { id: Date.now() + Math.random(), value: reward, x, y }]);
    }

    sendAction('click', { power: user.click_power });
  };

  const handleFeed = async () => {
    if (!user) return;
    if (user.food <= 0) {
      alert('Нет еды! Купи в магазине.');
      return;
    }
    const newFood = user.food - 1;
    const newStamina = Math.min(user.stamina + 10, user.max_stamina);

    setUser((prev: any) => ({ ...prev, food: newFood, stamina: newStamina }));
    await updateUser({ food: newFood, stamina: newStamina });
    alert('Питомец накормлен! +10 энергии');
    sendAction('feed');
  };

  const handlePlay = async () => {
    if (!user) return;
    if (user.stamina < 20) {
      alert('Недостаточно энергии для игры!');
      return;
    }
    const reward = eventActive ? 60 : 30;
    const newStamina = user.stamina - 20;
    const newGems = user.gems + reward;

    setUser((prev: any) => ({ ...prev, stamina: newStamina, gems: newGems }));
    await updateUser({ stamina: newStamina, gems: newGems });
    alert(`Поиграли! +${reward} алмазов`);
    sendAction('play');
  };

  // ==================== ПРИГЛАШЕНИЕ ДРУЗЕЙ ====================
  const userId = tg?.initDataUnsafe?.user?.id || 'guest123';
  const inviteLink = `https://t.me/ваш_бот?start=ref_${userId}`;

  const copyInviteLink = () => {
    navigator.clipboard.writeText(inviteLink);
    alert('✅ Ссылка скопирована!');
  };

  const handleInviteFriend = () => {
    setShowInviteMenu(true);
  };

  // ==================== РЕДАКТИРОВАНИЕ ИМЕНИ ====================
  const handleNameClick = () => {
    setIsEditing(true);
    setTempName(petName);
  };

  const handleNameSave = () => {
    if (tempName.trim()) {
      setPetName(tempName);
    }
    setIsEditing(false);
  };

  const handleNameCancel = () => {
    setIsEditing(false);
  };

  // ==================== МАГАЗИН ====================
  const buyFood = async (amount: number, price: number) => {
    if (!user) return;
    if (user.gems < price) {
      alert('Не хватает 💎 Алмазов!');
      return;
    }
    const newGems = user.gems - price;
    const newFood = Math.min(user.food + amount, 100);
    setUser((prev: any) => ({ ...prev, gems: newGems, food: newFood }));
    await updateUser({ gems: newGems, food: newFood });
    alert(`Куплено ${amount} еды`);
    sendAction('buyFood', { amount, price });
  };

  const buyClickUpgrade = async () => {
    if (!user) return;
    const cost = getClickUpgradeCost(user.click_upgrade_level);
    if (user.gems < cost) {
      alert('Не хватает 💎 Алмазов!');
      return;
    }
    const newGems = user.gems - cost;
    const newClickPower = user.click_power + 0.2;
    const newLevel = user.click_upgrade_level + 1;
    setUser((prev: any) => ({
      ...prev,
      gems: newGems,
      click_power: newClickPower,
      click_upgrade_level: newLevel,
    }));
    await updateUser({
      gems: newGems,
      click_power: newClickPower,
      click_upgrade_level: newLevel,
    });
    alert(`⚡ Сила клика увеличена до ${newClickPower.toFixed(1)}`);
    sendAction('buyClickUpgrade', { newPower: newClickPower });
  };

  const getClickUpgradeCost = (level: number) => 10 + level * 5;

  const buyRegenUpgrade = async () => {
    if (!user) return;
    const cost = getRegenUpgradeCost(user.regen_upgrade_level);
    if (user.gems < cost) {
      alert('Не хватает 💎 Алмазов!');
      return;
    }
    const newGems = user.gems - cost;
    const newRegen = user.stamina_regen_rate + 0.5;
    const newLevel = user.regen_upgrade_level + 1;
    setUser((prev: any) => ({
      ...prev,
      gems: newGems,
      stamina_regen_rate: newRegen,
      regen_upgrade_level: newLevel,
    }));
    await updateUser({
      gems: newGems,
      stamina_regen_rate: newRegen,
      regen_upgrade_level: newLevel,
    });
    alert(`⚡ Скорость регенерации увеличена до ${newRegen.toFixed(1)}/сек`);
    sendAction('buyRegenUpgrade', { newRate: newRegen });
  };

  const getRegenUpgradeCost = (level: number) => 15 + level * 8;

  const buyMaxStaminaUpgrade = async () => {
    if (!user) return;
    const cost = getMaxStaminaUpgradeCost(user.max_stamina_upgrade_level);
    if (user.gems < cost) {
      alert('Не хватает 💎 Алмазов!');
      return;
    }
    const newGems = user.gems - cost;
    const newMaxStamina = user.max_stamina + 20;
    const newStamina = user.stamina + 20;
    const newLevel = user.max_stamina_upgrade_level + 1;
    setUser((prev: any) => ({
      ...prev,
      gems: newGems,
      max_stamina: newMaxStamina,
      stamina: newStamina,
      max_stamina_upgrade_level: newLevel,
    }));
    await updateUser({
      gems: newGems,
      max_stamina: newMaxStamina,
      stamina: newStamina,
      max_stamina_upgrade_level: newLevel,
    });
    alert(`📈 Макс. энергия увеличена до ${newMaxStamina}`);
    sendAction('buyMaxStaminaUpgrade', { newMax: newMaxStamina });
  };

  const getMaxStaminaUpgradeCost = (level: number) => 30 + level * 10;

  if (loading || !user) {
    return (
      <div style={styles.loadingContainer}>
        <p>Загружаем питомца...</p>
      </div>
    );
  }

  const staminaPercent = (user.stamina / user.max_stamina) * 100;

  return (
    <div style={styles.container}>
      {/* Баннер ивента */}
      {eventActive && (
        <div style={styles.eventBanner}>
          ✨ Ивент: редкие питомцы доступны! Осталось {eventTimeLeft} ✨
        </div>
      )}

      {/* Шапка с профилем и именем */}
      <div style={styles.header}>
        <div style={styles.profile}>
          <div style={styles.avatar} onClick={() => setShowProfileMenu(true)}>
            {userAvatar}
          </div>
          <div style={styles.friendsBadge} onClick={handleInviteFriend}>
            👥 {user.friends_count}
          </div>
        </div>

        {isEditing ? (
          <div style={styles.nameEditor}>
            <input
              type="text"
              value={tempName}
              onChange={(e) => setTempName(e.target.value)}
              style={styles.nameInput}
              autoFocus
            />
            <button onClick={handleNameSave} style={styles.nameSaveBtn}>✅</button>
            <button onClick={handleNameCancel} style={styles.nameCancelBtn}>❌</button>
          </div>
        ) : (
          <div style={styles.nameDisplay} onClick={handleNameClick}>
            <span style={styles.petName}>{petName}</span>
            <span style={styles.editIcon}>✏️</span>
          </div>
        )}
      </div>

      {/* Основной контент */}
      <div style={styles.content}>
        {/* Четыре карточки */}
        <div style={styles.stats}>
          <div style={styles.statCard}>
            <span style={styles.statValue}>{level}</span>
            <span style={styles.statLabel}>📈 Уровень</span>
          </div>
          <div style={styles.statCard}>
            <span style={styles.statValue}>{user.food}</span>
            <span style={styles.statLabel}>🍖 Еда</span>
          </div>
          <div style={styles.statCard}>
            <span style={styles.statValue}>{user.gems?.toFixed(1)}</span>
            <span style={styles.statLabel}>💎 Алмазы</span>
          </div>
          <div style={styles.statCard}>
            <span style={styles.statValue}>{user.click_power.toFixed(1)}</span>
            <span style={styles.statLabel}>💥 Сила клика</span>
          </div>
        </div>

        {/* Полоска голода */}
        <div style={styles.barWrapper}>
          <div style={styles.barLabel}>🦴 Голод</div>
          <div style={styles.barBg}>
            <div style={{ ...styles.barFill, width: `${(user.food / 100) * 100}%`, background: '#ff9216' }} />
            <span style={styles.barText}>{user.food}/100</span>
          </div>
        </div>

        {/* Полоска опыта */}
        <div style={styles.barWrapper}>
          <div style={styles.barLabel}>📈 Опыт до след. уровня</div>
          <div style={styles.barBg}>
            <div style={{ ...styles.barFill, width: `${expPercent}%`, background: '#0285ff' }} />
            <span style={styles.barText}>{expInCurrentLevel}/{expNeeded}</span>
          </div>
        </div>

        {/* Питомец */}
        <div ref={petRef} style={styles.petCircle} onClick={handleClick}>
          <div style={{
            fontSize: '150px',
            transform: isClicking ? 'scale(0.9)' : 'scale(1)',
            transition: 'transform 0.1s',
          }}>
            {currentPetEmoji}
          </div>
          {floaters.map(f => (
            <div
              key={f.id}
              style={{
                position: 'absolute',
                left: f.x,
                top: f.y,
                color: '#ffd700',
                fontWeight: 'bold',
                fontSize: '20px',
                pointerEvents: 'none',
                animation: 'floatUp 1s ease-out forwards',
              }}
            >
              +{f.value.toFixed(1)}
            </div>
          ))}
        </div>

        {/* Полоска энергии */}
        <div style={styles.staminaWrapper}>
          <div style={styles.staminaLabel}>⚡ Энергия (+{user.stamina_regen_rate.toFixed(1)}/сек)</div>
          <div style={styles.staminaBarContainer}>
            <div style={{ ...styles.staminaBarFill, width: `${staminaPercent}%` }} />
            <span style={styles.staminaBarText}>{user.stamina}/{user.max_stamina}</span>
          </div>
        </div>
      </div>

      {/* Кнопки действий */}
      <div style={styles.buttonsContainer}>
        <div style={styles.actionsRow}>
          <button style={{ ...styles.button, ...styles.feedButton }} onClick={handleFeed}>
            🍖 Покормить
          </button>
          <button style={{ ...styles.button, ...styles.playButton }} onClick={handlePlay}>
            🎾 Поиграть
          </button>
        </div>
        <button style={{ ...styles.button, ...styles.shopButton, width: '100%' }} onClick={() => setShowShop(true)}>
          🛒 Магазин
        </button>
      </div>

      {/* Модальное окно профиля с вкладками */}
      {showProfileMenu && (
        <div style={styles.modalOverlay} onClick={() => setShowProfileMenu(false)}>
          <div style={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <h3 style={styles.modalTitle}>Мой профиль</h3>
              <button style={styles.closeButton} onClick={() => setShowProfileMenu(false)}>✕</button>
            </div>
            <div style={styles.tabs}>
              <button
                style={{ ...styles.tabButton, ...(activeProfileTab === 'profile' ? styles.activeTab : {}) }}
                onClick={() => setActiveProfileTab('profile')}
              >
                Профиль
              </button>
              <button
                style={{ ...styles.tabButton, ...(activeProfileTab === 'leaders' ? styles.activeTab : {}) }}
                onClick={() => setActiveProfileTab('leaders')}
              >
                Лидеры
              </button>
              <button
                style={{ ...styles.tabButton, ...(activeProfileTab === 'pets' ? styles.activeTab : {}) }}
                onClick={() => setActiveProfileTab('pets')}
              >
                Питомцы
              </button>
            </div>
            <div style={styles.modalBody}>
              {activeProfileTab === 'profile' ? (
                <>
                  <div style={styles.profileInfo}>
                    <div style={styles.profileAvatar}>{userAvatar}</div>
                    <div style={styles.profileDetails}>
                      <div><strong>Имя:</strong> {tg?.initDataUnsafe?.user?.first_name || 'Неизвестно'}</div>
                      <div><strong>Username:</strong> @{tg?.initDataUnsafe?.user?.username || 'не указан'}</div>
                      <div><strong>ID:</strong> {tg?.initDataUnsafe?.user?.id || '—'}</div>
                    </div>
                  </div>
                  <div style={styles.statsGrid}>
                    <div style={styles.statBox}>
                      <span style={styles.statBoxValue}>{user.friends_count}</span>
                      <span style={styles.statBoxLabel}>👥 Друзей</span>
                    </div>
                    <div style={styles.statBox}>
                      <span style={styles.statBoxValue}>{user.total_clicks}</span>
                      <span style={styles.statBoxLabel}>🖱️ Кликов</span>
                    </div>
                    <div style={styles.statBox}>
                      <span style={styles.statBoxValue}>{level}</span>
                      <span style={styles.statBoxLabel}>📈 Уровень</span>
                    </div>
                    <div style={styles.statBox}>
                      <span style={styles.statBoxValue}>{user.gems?.toFixed(1)}</span>
                      <span style={styles.statBoxLabel}>💎 Алмазы</span>
                    </div>
                  </div>
                  <div style={styles.referralSection}>
                    <button onClick={handleInviteFriend} style={styles.referralButton}>
                      👥 Пригласить друга
                    </button>
                  </div>
                </>
              ) : activeProfileTab === 'leaders' ? (
                <div style={styles.leadersList}>
                  <h4 style={styles.sectionTitle}>🏆 Топ 10 игроков</h4>
                  {leadersLoading ? (
                    <p style={styles.loadingText}>Загрузка...</p>
                  ) : leaders.length === 0 ? (
                    <p style={styles.loadingText}>Пока нет данных</p>
                  ) : (
                    leaders.map((player, index) => (
                      <div key={player.user_id} style={styles.leaderItem}>
                        <span style={styles.leaderPosition}>{index + 1}</span>
                        <span style={styles.leaderName}>{player.name}</span>
                        <span style={styles.leaderScore}>{player.gems.toLocaleString()} 💎</span>
                      </div>
                    ))
                  )}
                </div>
              ) : (
                <div style={styles.petsList}>
                  <h4 style={styles.sectionTitle}>🐾 Мои питомцы</h4>
                  {PETS.map(pet => {
                    const unlocked = isPetUnlocked(pet);
                    const isSelected = user.selected_pet === pet.id;
                    return (
                      <div
                        key={pet.id}
                        style={{
                          ...styles.petItem,
                          ...(isSelected ? styles.petItemSelected : {}),
                          ...(!unlocked ? styles.petItemLocked : {}),
                        }}
                        onClick={async () => {
                          if (!unlocked) return;
                          setUser((prev: any) => ({ ...prev, selected_pet: pet.id }));
                          await updateUser({ selected_pet: pet.id });
                        }}
                      >
                        <div style={styles.petItemEmoji}>{pet.emoji}</div>
                        <div style={styles.petItemInfo}>
                          <div style={styles.petItemName}>{pet.name}</div>
                          {!unlocked && (
                            <div style={styles.petItemCondition}>
                              🔒 {pet.unlock === 'level' && `нужен ${pet.level} уровень`}
                              {pet.unlock === 'invite' && `нужно ${pet.invites} друга`}
                              {pet.unlock === 'event' && 'доступен во время ивента'}
                            </div>
                          )}
                        </div>
                        {unlocked && isSelected && <div style={styles.petItemSelectedMark}>✓</div>}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Модальное окно приглашения */}
      {showInviteMenu && (
        <div style={styles.modalOverlay} onClick={() => setShowInviteMenu(false)}>
          <div style={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <h3 style={styles.modalTitle}>👥 Пригласить друга</h3>
              <button style={styles.closeButton} onClick={() => setShowInviteMenu(false)}>✕</button>
            </div>
            <div style={styles.modalBody}>
              <p style={styles.referralText}>
                Поделись ссылкой с другом. За каждого приглашённого ты получишь <strong>50 💎</strong>!
              </p>
              <div style={styles.inviteLinkContainer}>
                <input
                  type="text"
                  value={inviteLink}
                  readOnly
                  style={styles.inviteLinkInput}
                />
                <button onClick={copyInviteLink} style={styles.copyButton}>📋</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Модальное окно магазина */}
      {showShop && (
        <div style={styles.modalOverlay} onClick={() => setShowShop(false)}>
          <div style={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <h3 style={styles.modalTitle}>💎 Магазин</h3>
              <button style={styles.closeButton} onClick={() => setShowShop(false)}>✕</button>
            </div>
            <div style={styles.modalBody}>
              <div style={styles.shopSection}>
                <h4 style={styles.shopSectionTitle}>🍖 Еда</h4>
                <div style={styles.shopItem} onClick={() => buyFood(5, 20)}>
                  <span>🍖 5 еды</span>
                  <span>20 💎</span>
                </div>
                <div style={styles.shopItem} onClick={() => buyFood(10, 35)}>
                  <span>🍖 10 еды</span>
                  <span>35 💎</span>
                </div>
                <div style={styles.shopItem} onClick={() => buyFood(25, 80)}>
                  <span>🍖 25 еды</span>
                  <span>80 💎</span>
                </div>
              </div>
              <div style={styles.shopSection}>
                <h4 style={styles.shopSectionTitle}>⚡ Сила клика</h4>
                <div style={styles.shopItem} onClick={buyClickUpgrade}>
                  <span>⚡ Улучшить клик (сейчас {user.click_power.toFixed(1)} → {(user.click_power+0.2).toFixed(1)})</span>
                  <span>{getClickUpgradeCost(user.click_upgrade_level)} 💎</span>
                </div>
              </div>
              <div style={styles.shopSection}>
                <h4 style={styles.shopSectionTitle}>💪 Энергия</h4>
                <div style={styles.shopItem} onClick={buyRegenUpgrade}>
                  <span>⚡ Скорость регенерации (сейчас +{user.stamina_regen_rate.toFixed(1)}/сек → +{(user.stamina_regen_rate+0.5).toFixed(1)}/сек)</span>
                  <span>{getRegenUpgradeCost(user.regen_upgrade_level)} 💎</span>
                </div>
                <div style={styles.shopItem} onClick={buyMaxStaminaUpgrade}>
                  <span>📈 Макс. энергия (сейчас {user.max_stamina} → {user.max_stamina+20})</span>
                  <span>{getMaxStaminaUpgradeCost(user.max_stamina_upgrade_level)} 💎</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const styles = {
  container: {
    minHeight: '100vh',
    background: '#000',
    color: '#fff',
    padding: '20px',
    fontFamily: 'sans-serif',
    display: 'flex',
    flexDirection: 'column' as const,
    boxSizing: 'border-box' as const,
    position: 'relative' as const,
  },
  loadingContainer: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '100vh',
    background: '#000',
    color: '#fff',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '20px',
  },
  profile: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  avatar: {
    width: '40px',
    height: '40px',
    borderRadius: '50%',
    background: '#444',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '18px',
    fontWeight: 'bold',
    border: '2px solid #666',
    cursor: 'pointer',
  },
  friendsBadge: {
    background: '#222',
    borderRadius: '20px',
    padding: '4px 10px',
    fontSize: '14px',
    cursor: 'pointer',
    border: '1px solid #444',
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
  },
  nameDisplay: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    cursor: 'pointer',
  },
  petName: {
    fontSize: '20px',
    fontWeight: 'bold',
    color: '#fff',
  },
  editIcon: {
    fontSize: '16px',
    opacity: 0.7,
  },
  nameEditor: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
  },
  nameInput: {
    background: '#222',
    border: '1px solid #444',
    borderRadius: '6px',
    padding: '6px 10px',
    color: '#fff',
    fontSize: '16px',
    outline: 'none',
  },
  nameSaveBtn: {
    background: 'none',
    border: 'none',
    fontSize: '18px',
    cursor: 'pointer',
  },
  nameCancelBtn: {
    background: 'none',
    border: 'none',
    fontSize: '18px',
    cursor: 'pointer',
  },
  content: {
    flex: 0,
    overflowY: 'auto' as const,
    marginBottom: '10px',
  },
  title: {
    fontSize: '28px',
    fontWeight: 'bold',
    textAlign: 'center' as const,
    marginBottom: '20px',
    color: '#fff',
  },
  stats: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, 1fr)',
    gap: '8px',
    marginTop: '20px',
    marginBottom: '20px',
  },
  statCard: {
    background: '#222',
    borderRadius: '10px',
    padding: '12px',
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    border: '1px solid #444',
  },
  statValue: {
    fontSize: '18px',
    fontWeight: 'bold',
    color: '#fff',
  },
  statLabel: {
    fontSize: '12px',
    color: '#aaa',
    marginTop: '4px',
  },
  barWrapper: {
    marginBottom: '12px',
  },
  barLabel: {
    fontSize: '16px',
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: '3px',
  },
  barBg: {
    background: '#222',
    height: '25px',
    borderRadius: '10px',
    position: 'relative' as const,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: '10px',
    transition: 'width 0.3s ease',
  },
  barText: {
    position: 'absolute' as const,
    top: 0,
    left: 0,
    width: '100%',
    textAlign: 'center' as const,
    lineHeight: '25px',
    fontSize: '14px',
    color: '#000',
    fontWeight: 'bold',
  },
  petCircle: {
    position: 'relative' as const,
    width: '250px',
    height: '230px',
    margin: '60px auto 30px',
    background: '#222',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    border: '3px solid #444',
    overflow: 'hidden',
  },
  staminaWrapper: {
    marginTop: '40px',
    marginBottom: '10px',
  },
  staminaLabel: {
    fontSize: '16px',
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: '4px',
    textAlign: 'center' as const,
  },
  staminaBarContainer: {
    background: '#222',
    height: '25px',
    borderRadius: '12px',
    position: 'relative' as const,
    overflow: 'hidden',
    border: '1px solid #444',
  },
  staminaBarFill: {
    background: '#ffcc00',
    height: '100%',
    borderRadius: '12px',
    transition: 'width 0.3s ease',
  },
  staminaBarText: {
    position: 'absolute' as const,
    top: 0,
    left: 0,
    width: '100%',
    textAlign: 'center' as const,
    lineHeight: '25px',
    fontSize: '14px',
    color: '#000',
    fontWeight: 'bold',
  },
  buttonsContainer: {
    marginTop: '30px',
  },
  actionsRow: {
    display: 'flex',
    gap: '10px',
    marginBottom: '10px',
  },
  button: {
    flex: 1,
    padding: '12px',
    border: 'none',
    borderRadius: '8px',
    fontSize: '16px',
    fontWeight: 'bold',
    cursor: 'pointer',
    transition: 'opacity 0.2s',
    touchAction: 'manipulation',
  },
  feedButton: { background: '#666', color: '#fff' },
  playButton: { background: '#666', color: '#fff' },
  shopButton: { background: '#666', color: '#fff' },
  modalOverlay: {
    position: 'fixed' as const,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.8)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
  },
  modalContent: {
    background: '#111',
    borderRadius: '20px',
    width: '90%',
    maxWidth: '400px',
    padding: '20px',
    border: '1px solid #333',
    boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
  },
  modalHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '15px',
  },
  modalTitle: {
    fontSize: '20px',
    fontWeight: 'bold',
    color: '#fff',
    margin: 0,
  },
  closeButton: {
    background: 'none',
    border: 'none',
    color: '#aaa',
    fontSize: '24px',
    cursor: 'pointer',
  },
  modalBody: {
    maxHeight: '400px',
    overflowY: 'auto' as const,
  },
  tabs: {
    display: 'flex',
    marginBottom: '15px',
    borderBottom: '1px solid #444',
  },
  tabButton: {
    flex: 1,
    background: 'none',
    border: 'none',
    color: '#fff',
    padding: '10px',
    cursor: 'pointer',
    fontSize: '16px',
    borderBottom: '2px solid transparent',
  },
  activeTab: {
    borderBottom: '2px solid #ffcc00',
    color: '#ffcc00',
  },
  profileInfo: {
    display: 'flex',
    gap: '15px',
    marginBottom: '20px',
  },
  profileAvatar: {
    width: '60px',
    height: '60px',
    borderRadius: '50%',
    background: '#444',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '30px',
    fontWeight: 'bold',
    border: '2px solid #666',
  },
  profileDetails: {
    flex: 1,
    fontSize: '14px',
    color: '#fff',
  },
  statsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, 1fr)',
    gap: '10px',
    marginBottom: '20px',
  },
  statBox: {
    background: '#222',
    borderRadius: '8px',
    padding: '12px',
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    border: '1px solid #444',
  },
  statBoxValue: {
    fontSize: '20px',
    fontWeight: 'bold',
    color: '#ffcc00',
  },
  statBoxLabel: {
    fontSize: '12px',
    color: '#aaa',
    marginTop: '4px',
  },
  referralSection: {
    marginTop: '10px',
  },
  referralButton: {
    background: '#666',
    color: '#fff',
    border: 'none',
    borderRadius: '6px',
    padding: '10px',
    fontSize: '14px',
    cursor: 'pointer',
    width: '100%',
  },
  leadersList: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '8px',
  },
  sectionTitle: {
    fontSize: '16px',
    fontWeight: 'bold',
    color: '#ffcc00',
    marginBottom: '8px',
  },
  leaderItem: {
    display: 'flex',
    alignItems: 'center',
    background: '#222',
    borderRadius: '6px',
    padding: '8px 12px',
    border: '1px solid #444',
  },
  leaderPosition: {
    width: '30px',
    fontWeight: 'bold',
    color: '#ffcc00',
  },
  leaderName: {
    flex: 1,
    marginLeft: '10px',
  },
  leaderScore: {
    color: '#ffcc00',
    fontWeight: 'bold',
  },
  eventBanner: {
    background: '#ffcc00',
    color: '#000',
    padding: '10px',
    textAlign: 'center' as const,
    borderRadius: '8px',
    marginBottom: '10px',
    fontWeight: 'bold',
  },
  loadingText: {
    textAlign: 'center' as const,
    color: '#aaa',
    padding: '20px',
  },
  petsList: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '8px',
  },
  petItem: {
    display: 'flex',
    alignItems: 'center',
    background: '#222',
    borderRadius: '8px',
    padding: '10px',
    border: '1px solid #444',
    cursor: 'pointer',
    transition: 'background 0.2s',
  },
  petItemSelected: {
    border: '2px solid #ffcc00',
  },
  petItemLocked: {
    opacity: 0.5,
    cursor: 'not-allowed',
  },
  petItemEmoji: {
    fontSize: '32px',
    marginRight: '12px',
  },
  petItemInfo: {
    flex: 1,
  },
  petItemName: {
    fontSize: '16px',
    fontWeight: 'bold',
  },
  petItemCondition: {
    fontSize: '11px',
    color: '#aaa',
    marginTop: '2px',
  },
  petItemSelectedMark: {
    color: '#ffcc00',
    fontWeight: 'bold',
    fontSize: '18px',
    marginLeft: '8px',
  },
  referralText: {
    fontSize: '14px',
    color: '#ccc',
    marginBottom: '10px',
  },
  inviteLinkContainer: {
    display: 'flex',
    gap: '8px',
    marginBottom: '10px',
  },
  inviteLinkInput: {
    flex: 1,
    background: '#222',
    border: '1px solid #444',
    borderRadius: '6px',
    padding: '8px',
    color: '#fff',
    fontSize: '12px',
    outline: 'none',
  },
  copyButton: {
    background: '#444',
    border: 'none',
    borderRadius: '6px',
    padding: '8px 12px',
    color: '#fff',
    cursor: 'pointer',
    fontSize: '16px',
  },
  shopSection: {
    marginBottom: '20px',
  },
  shopSectionTitle: {
    fontSize: '16px',
    fontWeight: 'bold',
    color: '#ffcc00',
    marginBottom: '8px',
    paddingBottom: '4px',
    borderBottom: '1px solid #444',
  },
  shopItem: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    background: '#222',
    padding: '12px',
    borderRadius: '8px',
    marginBottom: '8px',
    cursor: 'pointer',
    border: '1px solid #444',
    transition: 'background 0.2s',
  },
} as const;

export default App;
