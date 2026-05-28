export function createNoopRepositories() {
  return {
    roomRepository: {
      async listActive() {
        return [];
      },
      async save() {},
      async get() {
        return null;
      },
      async getMany() {
        return [];
      },
      async findByInviteCode() {
        return null;
      },
      async update() {},
      async touch() {},
      async softDelete() {},
      async cleanupExpired() {
        return 0;
      },
    },
    messageRepository: {
      async listRecentByRoom() {
        return [];
      },
      async save() {},
      async update() {},
      async enforceLimit() {},
    },
    reportRepository: {
      async listRecent() {
        return [];
      },
      async listByRoom() {
        return [];
      },
      async create() {},
      async updateStatus() {},
      async clearAll() {},
    },
    moderationLogRepository: {
      async listRecent() {
        return [];
      },
      async create() {},
    },
    userRepository: {
      async upsert() {},
      async get() {
        return null;
      },
      async getPublic() {
        return null;
      },
      async updateProfile() {
        return null;
      },
      async listStats() {
        return { totalUsers: 0, loggedInUsers: 0, guestUsers: 0 };
      },
      async incrementStat() {},
      async listJoinedRooms() {
        return [];
      },
      async saveJoinedRoom() {},
      async updateJoinedRoom() {},
      async markRoomRead() {},
      async incrementRoomUnread() {},
      async updateNotificationSettings() {
        return null;
      },
      async setFavorite() {},
      async listBlockedUsers() {
        return [];
      },
      async blockUser() {},
      async unblockUser() {},
    },
    memberRepository: {
      async get() {
        return null;
      },
      async upsert() {},
      async updateRole() {},
      async updateModeration() {},
      async listByRoom() {
        return [];
      },
    },
    billingRepository: {
      async listEntitlements() {
        return [];
      },
      async saveEntitlement() {},
      async revokeEntitlement() {},
      async listPayments() {
        return [];
      },
      async savePayment() {},
      async updatePayment() {},
      async findPaymentByOrderId() {
        return null;
      },
      async listBillingEvents() {
        return [];
      },
      async getBillingEvent() {
        return null;
      },
      async saveBillingEvent() {},
      async listRecentEntitlements() {
        return [];
      },
      async listRecentPayments() {
        return [];
      },
    },
    notificationRepository: {
      async listForUser() {
        return [];
      },
      async create() {},
      async markRead() {},
      async markAllRead() {
        return 0;
      },
      async dismiss() {},
      async countUnread() {
        return 0;
      },
      async listRecent() {
        return [];
      },
    },
    pushTokenRepository: {
      async upsert() {},
      async disable() {},
      async listEnabledForUser() {
        return [];
      },
      async listRecent() {
        return [];
      },
    },
    announcementRepository: {
      async listActive() {
        return [];
      },
      async listRecent() {
        return [];
      },
      async create() {},
      async update() {},
    },
    activityRepository: {
      async listByRoom() {
        return [];
      },
      async listRecent() {
        return [];
      },
      async create() {},
    },
    communityRepository: {
      async listActive() {
        return [];
      },
      async listByOwner() {
        return [];
      },
      async get() {
        return null;
      },
      async findBySlug() {
        return null;
      },
      async save() {},
      async update() {},
      async softDelete() {},
    },
    communityMemberRepository: {
      async get() {
        return null;
      },
      async upsert() {},
      async updateRole() {},
      async updateModeration() {},
      async remove() {},
      async listByCommunity() {
        return [];
      },
    },
    communityRoomRepository: {
      async upsert() {},
      async listByCommunity() {
        return [];
      },
    },
    communityAnnouncementRepository: {
      async listRecent() {
        return [];
      },
      async create() {},
      async update() {},
    },
    communityActivityRepository: {
      async listByCommunity() {
        return [];
      },
      async listRecent() {
        return [];
      },
      async create() {},
    },
    eventRepository: {
      async listRecent() {
        return [];
      },
      async listByCommunity() {
        return [];
      },
      async listByHost() {
        return [];
      },
      async get() {
        return null;
      },
      async save() {},
      async update() {},
    },
    rsvpRepository: {
      async upsert() {},
      async listByEvent() {
        return [];
      },
      async countByEvent() {
        return 0;
      },
    },
    scheduledAnnouncementRepository: {
      async listRecent() {
        return [];
      },
      async listByCreator() {
        return [];
      },
      async listDue() {
        return [];
      },
      async get() {
        return null;
      },
      async save() {},
      async update() {},
    },
    feedbackRepository: {
      async create() {},
      async listRecent() {
        return [];
      },
      async updateStatus() {},
    },
    analyticsRepository: {
      isEnabled: false,
      async incrementDaily() {},
      async listDaily() {
        return [];
      },
    },
    categoryToolRepository: {
      async listByRoom() {
        return [];
      },
      async save() {},
      async update() {},
      async delete() {},
      async listAdmin() {
        return [];
      },
    },
  };
}
