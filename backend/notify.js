const { uuid } = require('./db');

/**
 * Push a notification into db.notifications (caller must saveDB afterwards).
 * type: 'friend_request' | 'friend_accept' | 'birthday' | 'verification_approved' | 'verification_rejected' | 'like' | 'comment'
 */
function pushNotification(db, { userId, type, actorId, data }) {
  if (userId === actorId) return; // never notify yourself
  db.notifications.push({
    id: uuid(),
    userId,
    type,
    actorId: actorId || null,
    data: data || {},
    read: false,
    createdAt: new Date().toISOString()
  });
}

// Checks every user's friends for a birthday matching today, and notifies once per year.
function checkBirthdaysAndNotify(db) {
  const now = new Date();
  const todayMD = `${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const year = now.getFullYear();

  db.users.forEach(celebrant => {
    if (!celebrant.birthday) return;
    const [, m, d] = celebrant.birthday.split('-');
    if (`${m}-${d}` !== todayMD) return;
    if (celebrant.lastBirthdayNotifiedYear === year) return; // already notified this year

    (celebrant.friends || []).forEach(friendId => {
      pushNotification(db, {
        userId: friendId,
        type: 'birthday',
        actorId: celebrant.id,
        data: { name: celebrant.fullName || celebrant.username }
      });
    });
    celebrant.lastBirthdayNotifiedYear = year;
  });
}

module.exports = { pushNotification, checkBirthdaysAndNotify };
