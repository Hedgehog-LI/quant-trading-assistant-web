import dayjs from 'dayjs';

/** 获取今日日期字符串 yyyy-MM-dd */
export function today(): string {
  return dayjs().format('YYYY-MM-DD');
}

/** 格式化日期字符串 */
export function formatDate(date: string): string {
  return dayjs(date).format('YYYY-MM-DD');
}

/** 格式化日期时间字符串 */
export function formatDateTime(datetime: string): string {
  return dayjs(datetime).format('YYYY-MM-DD HH:mm');
}

/** 判断是否是今天 */
export function isToday(date: string): boolean {
  return dayjs(date).format('YYYY-MM-DD') === today();
}
