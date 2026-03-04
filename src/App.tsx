import React, { useEffect, useState } from 'react';

const tg = window.Telegram?.WebApp;

function App() {
  const [energy, setEnergy] = useState<number | null>(null);
  const [level, setLevel] = useState<number | null>(null);

  useEffect(() => {
    if (tg) {
      tg.ready();
      tg.expand(); // растягиваем на весь экран
    }
  }, []);

  const handleFeed = () => {
    if (tg) {
      tg.sendData(JSON.stringify({ action: 'feed' }));
      setEnergy(prev => prev ? prev + 10 : 110);
    }
  };

  const handlePlay = () => {
    if (tg) {
      tg.sendData(JSON.stringify({ action: 'play' }));
      setEnergy(prev => prev ? prev - 5 : 95);
    }
  };

  return (
    <div style={{ padding: 20, fontFamily: 'sans-serif' }}>
      <h1>Мой AI-питомец</h1>
      <p>⚡ Энергия: {energy ?? 'загрузка...'}</p>
      <p>📈 Уровень: {level ?? 'загрузка...'}</p>
      <button onClick={handleFeed} style={{ marginRight: 10 }}>🍖 Покормить</button>
      <button onClick={handlePlay}>🎾 Поиграть</button>
    </div>
  );
}

export default App;