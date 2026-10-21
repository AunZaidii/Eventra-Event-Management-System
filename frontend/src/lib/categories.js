// Event categories (same fixed list as the API) with their tint colors.
export const CATEGORIES = ['Conference', 'Workshop', 'Meetup', 'Concert', 'Sports', 'Webinar', 'Other'];

const TINTS = {
  Conference: { bg: '#E0E7FF', ink: '#4338CA' },
  Workshop: { bg: '#CCFBF1', ink: '#0F766E' },
  Meetup: { bg: '#FEF3C7', ink: '#B45309' },
  Concert: { bg: '#FCE7F3', ink: '#BE185D' },
  Sports: { bg: '#DCFCE7', ink: '#15803D' },
  Webinar: { bg: '#E0F2FE', ink: '#0369A1' },
  Other: { bg: '#F1F5F9', ink: '#475569' },
};

export const categoryTint = (category) => TINTS[category] || TINTS.Other;
