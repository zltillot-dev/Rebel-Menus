import { useState, useEffect, useCallback } from 'react';
import { 
  requestNotificationPermission, 
  getNotificationPermission,
  showMenuSubmittedNotification,
  showMenuApprovedNotification,
  showMenuRejectedNotification,
  showSubstitutionDecisionNotification,
  showNewMenuNotification
} from '@/lib/notifications';

export function useNotifications() {
  const [permission, setPermission] = useState<NotificationPermission | 'unsupported'>(
    getNotificationPermission()
  );
  const [isRequesting, setIsRequesting] = useState(false);

  useEffect(() => {
    setPermission(getNotificationPermission());
  }, []);

  const requestPermission = useCallback(async () => {
    setIsRequesting(true);
    const granted = await requestNotificationPermission();
    setPermission(getNotificationPermission());
    setIsRequesting(false);
    return granted;
  }, []);

  const notifyMenuSubmitted = useCallback((chefName: string, fraternity: string) => {
    if (permission === 'granted') {
      showMenuSubmittedNotification(chefName, fraternity);
    }
  }, [permission]);

  const notifyMenuApproved = useCallback((weekOf: string) => {
    if (permission === 'granted') {
      showMenuApprovedNotification(weekOf);
    }
  }, [permission]);

  const notifyMenuRejected = useCallback((weekOf: string) => {
    if (permission === 'granted') {
      showMenuRejectedNotification(weekOf);
    }
  }, [permission]);

  const notifySubstitutionDecision = useCallback((approved: boolean, mealInfo: string) => {
    if (permission === 'granted') {
      showSubstitutionDecisionNotification(approved, mealInfo);
    }
  }, [permission]);

  const notifyNewMenu = useCallback((fraternity: string, weekOf: string) => {
    if (permission === 'granted') {
      showNewMenuNotification(fraternity, weekOf);
    }
  }, [permission]);

  return {
    permission,
    isSupported: permission !== 'unsupported',
    isGranted: permission === 'granted',
    isDenied: permission === 'denied',
    isRequesting,
    requestPermission,
    notifyMenuSubmitted,
    notifyMenuApproved,
    notifyMenuRejected,
    notifySubstitutionDecision,
    notifyNewMenu,
  };
}
