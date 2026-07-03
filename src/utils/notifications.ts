export const requestNotificationPermission = async () => {
  if (!('Notification' in window)) return false;
  const permission = await Notification.requestPermission();
  return permission === 'granted';
};

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding)
    .replace(/\-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export const subscribeToPushNotifications = async (userId: number) => {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    console.warn('Push notifications not supported');
    return;
  }

  try {
    const registration = await navigator.serviceWorker.ready;
    
    // Get public key from server
    const keyRes = await fetch('/api/push/key');
    const { publicKey } = await keyRes.json();

    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey)
    });

    // Send subscription to server
    await fetch('/api/push/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, subscription })
    });

    console.log('Push subscription successful');
  } catch (error) {
    console.error('Failed to subscribe to push notifications', error);
  }
};

export const showPushNotification = async (userId: number, title: string, body: string, type: 'newDispatch' | 'statusUpdates' | 'feedback' = 'statusUpdates', url?: string) => {
  const stored = localStorage.getItem(`rq_notification_prefs_${userId}`);
  let prefs = {
    soundEnabled: true,
    pushEnabled: true,
    alertTypes: {
      newDispatch: true,
      statusUpdates: true,
      feedback: true,
    }
  };
  
  if (stored) {
    try {
      prefs = { ...prefs, ...JSON.parse(stored) };
    } catch (e) {}
  }

  if (!prefs.pushEnabled) return;
  if (!prefs.alertTypes[type]) return;

  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  
  const options = {
    body,
    icon: '/favicon.ico',
    badge: '/favicon.ico',
    vibrate: [200, 100, 200],
    data: { url: url || '/' }
  };

  try {
    const registration = await navigator.serviceWorker.ready;
    await registration.showNotification(title, options);
  } catch (e) {
    try {
      new Notification(title, options);
    } catch (err) {
      console.error('Failed to show notification', err);
    }
  }
  
  // Also play a sound
  if (prefs.soundEnabled) {
    try {
      const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3');
      await audio.play();
    } catch (e) {
      // Ignore audio play errors (e.g., user hasn't interacted with document)
    }
  }
};
