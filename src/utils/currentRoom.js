const CURRENT_ROOM_KEY = 'nexusChat.currentRoom.v1';

export function loadCurrentRoom() {
  try {
    const value = JSON.parse(localStorage.getItem(CURRENT_ROOM_KEY) || 'null');

    if (!value?.roomId && !value?.inviteCode) {
      return null;
    }

    return {
      roomId: value.roomId || '',
      inviteCode: value.inviteCode || '',
    };
  } catch {
    return null;
  }
}

export function saveCurrentRoom(room) {
  if (!room?.roomId) {
    return;
  }

  localStorage.setItem(
    CURRENT_ROOM_KEY,
    JSON.stringify({
      roomId: room.roomId,
      inviteCode: room.inviteCode || '',
    }),
  );
}

export function clearCurrentRoom() {
  localStorage.removeItem(CURRENT_ROOM_KEY);
}
