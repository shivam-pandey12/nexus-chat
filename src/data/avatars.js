export const AVATARS = [
  { id: 'nexus', label: 'NX', name: 'Nexus', tone: 'warm' },
  { id: 'ivory', label: 'IV', name: 'Ivory', tone: 'light' },
  { id: 'gold', label: 'GL', name: 'Gold', tone: 'gold' },
  { id: 'sage', label: 'SG', name: 'Sage', tone: 'sage' },
  { id: 'onyx', label: 'OX', name: 'Onyx', tone: 'dark' },
  { id: 'rose', label: 'RS', name: 'Rose', tone: 'rose' },
];

export function getAvatar(id) {
  return AVATARS.find((avatar) => avatar.id === id) || AVATARS[0];
}
