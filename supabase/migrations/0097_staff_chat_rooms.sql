-- Splits the single staff chat into named rooms: 'all' (every staff role,
-- the original /staff-chat room) and 'admin' (owner admin + branch admin
-- only, for admin-only discussion technicians/riders shouldn't see).
-- Existing rows default to 'all' so the current chat's history stays put.
alter table staff_chat_messages add column if not exists room text not null default 'all';
create index staff_chat_messages_room_created_at_idx on staff_chat_messages (room, created_at);
