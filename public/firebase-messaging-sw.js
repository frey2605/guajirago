importScripts('https://www.gstatic.com/firebasejs/10.0.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.0.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "AIzaSyCP9QFCiJ-ugqpowMedEdabxTcg4tC0X2A",
  authDomain: "guajirago.firebaseapp.com",
  projectId: "guajirago",
  storageBucket: "guajirago.firebasestorage.app",
  messagingSenderId: "909490051480",
  appId: "1:909490051480:web:b762e1fe84f5bfc32873ed"
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  const { title, body } = payload.notification;
  self.registration.showNotification(title, {
    body,
    icon: '/logo192.png',
    badge: '/logo192.png',
  });
});
