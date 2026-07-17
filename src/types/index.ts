export type BadgeStyle =
  // Blue variants
  | 'blue_burst' | 'blue_star' | 'blue_circle' | 'blue_wavy' | 'blue_seal'
  | 'blue_burst2' | 'blue_burst3' | 'blue_burst4' | 'blue_burst5'
  // Sky/Light Blue
  | 'sky_burst' | 'sky_circle' | 'sky_star' | 'sky_burst2' | 'sky_burst3'
  // Purple / Violet
  | 'purple_burst' | 'purple_star' | 'purple_circle' | 'purple_wavy' | 'purple_burst2' | 'purple_burst3'
  // Indigo / Navy
  | 'indigo_burst' | 'indigo_star' | 'indigo_burst2'
  // Green
  | 'green_burst' | 'green_star' | 'green_circle' | 'green_wavy' | 'green_burst2' | 'green_burst3'
  // Lime
  | 'lime_burst' | 'lime_star' | 'lime_burst2'
  // Red / Pink
  | 'red_burst' | 'red_star' | 'red_circle' | 'red_burst2' | 'red_burst3'
  // Pink
  | 'pink_burst' | 'pink_star' | 'pink_circle' | 'pink_burst2'
  // Gold / Yellow
  | 'gold_burst' | 'gold_star' | 'gold_circle' | 'gold_burst2'
  // Orange
  | 'orange_burst' | 'orange_star' | 'orange_burst2'
  // Gray / Silver
  | 'gray_burst' | 'gray_star' | 'gray_circle' | 'silver_burst' | 'silver_star'
  // White
  | 'white_burst' | 'white_star' | 'white_circle' | 'white_seal'
  // Black
  | 'black_burst' | 'black_star' | 'black_circle' | 'black_seal'
  // Cyan / Teal
  | 'cyan_burst' | 'cyan_star' | 'cyan_burst2'
  | 'teal_burst' | 'teal_star' | 'teal_burst2'
  // Gradient / Multi-color
  | 'rainbow_burst' | 'rainbow_star' | 'rainbow_seal' | 'rainbow_wavy'
  | 'gradient_burst' | 'gradient_star' | 'gradient_seal'
  | 'sunset_burst' | 'sunset_star'
  | 'ocean_burst' | 'ocean_star'
  | 'fire_burst' | 'fire_star'
  | 'aurora_burst' | 'aurora_star'
  | 'neon_burst' | 'neon_star'
  // Legacy (kept for compatibility, mapped to burst)
  | 'blue_shield' | 'black_shield' | 'red_shield' | 'gold_shield' | 'green_shield' | 'gray_shield';

export interface UserProfile {
  id: string;
  email: string;
  username?: string;
  full_name?: string;
  avatar_url?: string;
  cover_url?: string;
  is_vip: boolean;
  vip_expires_at?: string;
  blue_tick: boolean;
  is_banned: boolean;
  is_muted: boolean;
  referral_code?: string;
  referred_by?: string;
  joined_at?: string;
  phone_number?: string;
  phone_privacy?: 'public' | 'private';
  is_online?: boolean;
  last_seen?: string;
  badge_style?: BadgeStyle;
}

export interface AuthUser {
  id: string;
  email: string;
  username: string;
  avatar?: string;
  is_admin: boolean;
}

export interface Signal {
  id: string;
  title: string;
  pair: string;
  type: 'forex' | 'gold' | 'crypto';
  direction: 'BUY' | 'SELL';
  entry: string;
  stop_loss: string;
  take_profit: string;
  status: 'active' | 'closed' | 'pending';
  is_vip: boolean;
  is_pinned: boolean;
  result?: string;
  pips?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface Course {
  id: string;
  title: string;
  description?: string;
  thumbnail_url?: string;
  category: string;
  is_free: boolean;
  price_usd: number;
  is_published: boolean;
  order_index: number;
  total_lessons: number;
  created_at: string;
}

export interface CourseLesson {
  id: string;
  course_id: string;
  title: string;
  content?: string;
  video_url?: string;
  file_url?: string;
  duration_minutes: number;
  order_index: number;
  is_free: boolean;
}

export interface PaymentRequest {
  id: string;
  user_id: string;
  plan_id: string;
  plan_name: string;
  plan_duration: string;
  amount: number;
  status: 'pending' | 'approved' | 'rejected';
  screenshot_url?: string;
  notes?: string;
  admin_notes?: string;
  approved_at?: string;
  created_at: string;
  user_profiles?: UserProfile;
}

export interface VIPMessage {
  id: string;
  user_id?: string;
  message?: string;
  media_url?: string;
  media_type?: string;
  reply_to?: string;
  is_pinned: boolean;
  is_announcement: boolean;
  is_deleted: boolean;
  created_at: string;
  user_profiles?: UserProfile;
  reactions?: VIPReaction[];
}

export interface VIPReaction {
  id: string;
  message_id: string;
  user_id: string;
  emoji: string;
}

export interface AdminStatus {
  id: string;
  title?: string;
  media_url: string;
  media_type: 'image' | 'video';
  text_content?: string;
  is_active: boolean;
  expires_at: string;
  created_at: string;
}

export interface VIPPlan {
  id: string;
  name: string;
  duration: string;
  days: number;
  price: number;
}

export interface SiteSettings {
  id: string;
  whatsapp_number: string;
  payment_name: string;
  payment_number: string;
  website_name: string;
  logo_url?: string;
  hero_banner_url?: string;
  hero_title: string;
  hero_subtitle: string;
  vip_plans: VIPPlan[];
  social_links: Record<string, string>;
}

export interface Testimonial {
  id: string;
  name: string;
  avatar_url?: string;
  content: string;
  rating: number;
  is_published: boolean;
  order_index: number;
}

export interface ReferralLink {
  id: string;
  code: string;
  label?: string;
  clicks: number;
  registrations: number;
  payments: number;
  paying_referrals: number;
  reward_granted: boolean;
  owner_user_id?: string;
  created_at: string;
}

export interface AppVersion {
  id: string;
  version_name: string;
  version_code: number;
  apk_url?: string;
  release_notes?: string;
  is_latest: boolean;
  force_update: boolean;
  created_at: string;
}

export interface Conversation {
  id: string;
  participant_one: string;
  participant_two: string;
  last_message?: string;
  last_message_at: string;
  created_at: string;
  other_user?: UserProfile;
  unread_count?: number;
}

export interface DirectMessage {
  id: string;
  conversation_id: string;
  sender_id: string;
  message?: string;
  media_url?: string;
  media_type?: string;
  is_read: boolean;
  is_deleted: boolean;
  created_at: string;
  sender?: UserProfile;
  reply_to_id?: string;
  reply_preview?: string;
  reply_sender?: string;
}

export interface Notification {
  id: string;
  title: string;
  body: string;
  type: string;
  target_user_id?: string;
  is_read: boolean;
  created_at: string;
}
