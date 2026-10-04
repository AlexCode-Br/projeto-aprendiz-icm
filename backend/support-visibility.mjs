// Bind viewer once; every message query reuses the same per-account visibility.
export const supportViewerCte = 'WITH viewer AS (SELECT CAST(? AS INTEGER) AS user_id)';
export function supportVisible(message='m',ticket='t') {
  return `${message}.id>COALESCE((SELECT h.cut_message_id FROM support_conversation_hides h
    WHERE h.user_id=(SELECT user_id FROM viewer) AND h.professor_user_id=${ticket}.requester_user_id),0)
    AND NOT EXISTS(SELECT 1 FROM support_message_hides h WHERE h.message_id=${message}.id
      AND h.user_id=(SELECT user_id FROM viewer))`;
}
