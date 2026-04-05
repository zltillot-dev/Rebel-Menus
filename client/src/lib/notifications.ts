// Browser Notification Utility

export type NotificationType = 
  | 'menu_submitted'
  | 'menu_approved'
  | 'menu_rejected'
  | 'substitution_approved'
  | 'substitution_rejected'
  | 'new_menu';

interface NotificationOptions {
  title: string;
  body: string;
  icon?: string;
  tag?: string;
}

const notificationTitles: Record<NotificationType, string> = {
  menu_submitted: 'New Menu Submitted',
  menu_approved: 'Menu Approved',
  menu_rejected: 'Menu Needs Revision',
  substitution_approved: 'Substitution Approved',
  substitution_rejected: 'Substitution Denied',
  new_menu: 'New Menu Available',
};

export async function requestNotificationPermission(): Promise<boolean> {
  if (!('Notification' in window)) {
    console.log('Browser does not support notifications');
    return false;
  }

  if (Notification.permission === 'granted') {
    return true;
  }

  if (Notification.permission !== 'denied') {
    const permission = await Notification.requestPermission();
    return permission === 'granted';
  }

  return false;
}

export function getNotificationPermission(): NotificationPermission | 'unsupported' {
  if (!('Notification' in window)) {
    return 'unsupported';
  }
  return Notification.permission;
}

export function showNotification(type: NotificationType, options: Partial<NotificationOptions> = {}): boolean {
  if (!('Notification' in window) || Notification.permission !== 'granted') {
    return false;
  }

  const title = options.title || notificationTitles[type];
  const notificationBody = options.body || '';
  const notificationIcon = options.icon || '/icons/icon-192x192.png';
  const notificationTag = options.tag || type;

  try {
    const notification = new Notification(title, {
      body: notificationBody,
      icon: notificationIcon,
      tag: notificationTag,
    });
    
    notification.onclick = () => {
      window.focus();
      notification.close();
    };

    setTimeout(() => notification.close(), 5000);
    return true;
  } catch (error) {
    console.error('Failed to show notification:', error);
    return false;
  }
}

export function showMenuSubmittedNotification(chefName: string, fraternity: string) {
  return showNotification('menu_submitted', {
    body: `${chefName} from ${fraternity} has submitted a new menu for review.`,
  });
}

export function showMenuApprovedNotification(weekOf: string) {
  return showNotification('menu_approved', {
    body: `Your menu for the week of ${weekOf} has been approved!`,
  });
}

export function showMenuRejectedNotification(weekOf: string) {
  return showNotification('menu_rejected', {
    body: `Your menu for the week of ${weekOf} needs revision. Check admin notes.`,
  });
}

export function showSubstitutionDecisionNotification(approved: boolean, mealInfo: string) {
  return showNotification(approved ? 'substitution_approved' : 'substitution_rejected', {
    body: approved 
      ? `Your substitution request for ${mealInfo} has been approved!`
      : `Your substitution request for ${mealInfo} was not approved.`,
  });
}

export function showNewMenuNotification(fraternity: string, weekOf: string) {
  return showNotification('new_menu', {
    body: `A new menu for ${fraternity} is available for the week of ${weekOf}.`,
  });
}
