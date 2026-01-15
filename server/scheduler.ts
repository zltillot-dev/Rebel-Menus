// Scheduler for automatic late plate SMS notifications
// Sends SMS to chefs at cutoff times (12:45 PM for lunch, 5:45 PM for dinner)

import { storage } from './storage';
import { sendSMS } from './twilio';
import { format } from 'date-fns';

interface ScheduledJob {
  name: string;
  hour: number;
  minute: number;
  mealType: 'Lunch' | 'Dinner';
  lastRun: Date | null;
}

const jobs: ScheduledJob[] = [
  { name: 'lunch-late-plates', hour: 12, minute: 45, mealType: 'Lunch', lastRun: null },
  { name: 'dinner-late-plates', hour: 17, minute: 45, mealType: 'Dinner', lastRun: null }
];

async function sendLatePlateNotification(mealType: 'Lunch' | 'Dinner') {
  const today = new Date();
  const todayStr = format(today, 'yyyy-MM-dd');
  const dayName = format(today, 'EEEE');
  
  console.log(`[Scheduler] Sending ${mealType} late plate notifications for ${todayStr}`);
  
  // Skip Wednesday dinners - no late plates available
  if (mealType === 'Dinner' && today.getDay() === 3) {
    console.log('[Scheduler] Skipping Wednesday dinner notifications');
    return;
  }
  
  // Get all chefs
  const allUsers = await storage.getUsers();
  const chefs = allUsers.filter((u: any) => u.role === 'chef' && u.fraternity && u.phoneNumber);
  
  if (chefs.length === 0) {
    console.log('[Scheduler] No chefs with phone numbers found');
    return;
  }
  
  // Get all late plates for today's meal
  const allRequests = await storage.getRequests();
  
  for (const chef of chefs) {
    // Filter late plates for this chef's fraternity and today's meal
    const latePlates = allRequests.filter(r => 
      r.type === 'late_plate' &&
      r.fraternity === chef.fraternity &&
      r.mealDay === todayStr &&
      r.mealType === mealType
    );
    
    if (latePlates.length === 0) {
      console.log(`[Scheduler] No late plates for ${chef.fraternity} ${mealType}`);
      continue;
    }
    
    // Get user names for the late plates
    const latePlateUsers = await Promise.all(
      latePlates.map(async (lp) => {
        const user = await storage.getUser(lp.userId);
        return {
          name: user?.name || 'Unknown',
          details: lp.details
        };
      })
    );
    
    // Compose message (no emojis per design guidelines)
    const memberList = latePlateUsers
      .map((u, i) => `${i + 1}. ${u.name}${u.details ? ` - ${u.details}` : ''}`)
      .join('\n');
    
    const message = `Rebel Chefs - ${chef.fraternity}\n\n` +
      `${dayName} ${mealType} Late Plates (${latePlates.length}):\n\n` +
      `${memberList}`;
    
    // Send SMS
    const success = await sendSMS(chef.phoneNumber!, message);
    if (success) {
      console.log(`[Scheduler] SMS sent to chef ${chef.name} for ${chef.fraternity}`);
    } else {
      console.error(`[Scheduler] Failed to send SMS to chef ${chef.name}`);
    }
  }
}

function shouldRunJob(job: ScheduledJob, now: Date): boolean {
  const isCorrectTime = now.getHours() === job.hour && now.getMinutes() === job.minute;
  
  if (!isCorrectTime) return false;
  
  // Check if already ran this minute
  if (job.lastRun) {
    const lastRunMinute = job.lastRun.getHours() * 60 + job.lastRun.getMinutes();
    const nowMinute = now.getHours() * 60 + now.getMinutes();
    const isSameDay = job.lastRun.toDateString() === now.toDateString();
    
    if (isSameDay && lastRunMinute === nowMinute) {
      return false;
    }
  }
  
  return true;
}

async function checkAndRunJobs() {
  const now = new Date();
  
  for (const job of jobs) {
    if (shouldRunJob(job, now)) {
      console.log(`[Scheduler] Running job: ${job.name}`);
      job.lastRun = new Date();
      
      try {
        await sendLatePlateNotification(job.mealType);
      } catch (error) {
        console.error(`[Scheduler] Error running job ${job.name}:`, error);
      }
    }
  }
}

let schedulerInterval: NodeJS.Timeout | null = null;
let cleanupInterval: NodeJS.Timeout | null = null;

// Cleanup old substitutions and menu suggestions (older than 60 days)
async function cleanupOldRequests() {
  try {
    const sixtyDaysAgo = new Date();
    sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);
    
    const allRequests = await storage.getRequests();
    const oldRequests = allRequests.filter(r => {
      if (r.type !== 'substitution' && r.type !== 'menu_suggestion') return false;
      const requestDate = new Date(r.date || '');
      return requestDate < sixtyDaysAgo;
    });
    
    if (oldRequests.length > 0) {
      console.log(`[Cleanup] Deleting ${oldRequests.length} old substitutions/menu suggestions`);
      for (const req of oldRequests) {
        await storage.deleteRequest(req.id);
      }
      console.log('[Cleanup] Cleanup complete');
    }
  } catch (error) {
    console.error('[Cleanup] Error cleaning up old requests:', error);
  }
}

export function startScheduler() {
  if (schedulerInterval) {
    console.log('[Scheduler] Already running');
    return;
  }
  
  console.log('[Scheduler] Starting late plate notification scheduler');
  console.log('[Scheduler] Jobs scheduled:');
  console.log('  - Lunch late plates: 12:45 PM');
  console.log('  - Dinner late plates: 5:45 PM');
  console.log('  - Daily cleanup: Old substitutions/menu suggestions (60 days)');
  
  // Check every 30 seconds
  schedulerInterval = setInterval(checkAndRunJobs, 30000);
  
  // Cleanup daily (run every 24 hours, also run once on startup)
  cleanupOldRequests();
  cleanupInterval = setInterval(cleanupOldRequests, 24 * 60 * 60 * 1000);
  
  // Also run immediately to check current time
  checkAndRunJobs();
}

export function stopScheduler() {
  if (schedulerInterval) {
    clearInterval(schedulerInterval);
    schedulerInterval = null;
    console.log('[Scheduler] Stopped');
  }
}

// Manual trigger for testing
export async function triggerLatePlateNotification(mealType: 'Lunch' | 'Dinner') {
  console.log(`[Scheduler] Manual trigger for ${mealType} notifications`);
  await sendLatePlateNotification(mealType);
}
