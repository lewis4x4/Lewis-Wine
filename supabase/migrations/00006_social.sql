-- Social Features: Friendships and Shared Tastings
-- Migration: 00006_social.sql

-- Friendships table (bidirectional connections)
CREATE TABLE friendships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  addressee_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined', 'blocked')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(requester_id, addressee_id),
  CHECK (requester_id != addressee_id)
);

-- User profiles for social features (display names, avatars)
CREATE TABLE user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  avatar_url TEXT,
  bio TEXT,
  is_public BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Shared tastings (ratings shared to feed)
CREATE TABLE shared_tastings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  rating_id UUID NOT NULL REFERENCES ratings(id) ON DELETE CASCADE,
  visibility TEXT NOT NULL DEFAULT 'friends' CHECK (visibility IN ('friends', 'public')),
  caption TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Likes on shared tastings
CREATE TABLE tasting_likes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shared_tasting_id UUID NOT NULL REFERENCES shared_tastings(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(shared_tasting_id, user_id)
);

-- Comments on shared tastings
CREATE TABLE tasting_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shared_tasting_id UUID NOT NULL REFERENCES shared_tastings(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_friendships_requester ON friendships(requester_id);
CREATE INDEX idx_friendships_addressee ON friendships(addressee_id);
CREATE INDEX idx_friendships_status ON friendships(status);
CREATE INDEX idx_user_profiles_public ON user_profiles(is_public) WHERE is_public = true;
CREATE INDEX idx_shared_tastings_user ON shared_tastings(user_id);
CREATE INDEX idx_shared_tastings_created ON shared_tastings(created_at DESC);
CREATE INDEX idx_shared_tastings_visibility ON shared_tastings(visibility);
CREATE INDEX idx_tasting_likes_tasting ON tasting_likes(shared_tasting_id);
CREATE INDEX idx_tasting_comments_tasting ON tasting_comments(shared_tasting_id);

-- Row Level Security
ALTER TABLE friendships ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE shared_tastings ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasting_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasting_comments ENABLE ROW LEVEL SECURITY;

-- Friendships policies
CREATE POLICY "Users can view their own friendships"
  ON friendships FOR SELECT
  USING (auth.uid() = requester_id OR auth.uid() = addressee_id);

CREATE POLICY "Users can send friend requests"
  ON friendships FOR INSERT
  WITH CHECK (auth.uid() = requester_id);

CREATE POLICY "Users can update friendships they're part of"
  ON friendships FOR UPDATE
  USING (auth.uid() = requester_id OR auth.uid() = addressee_id);

CREATE POLICY "Users can delete their own friendships"
  ON friendships FOR DELETE
  USING (auth.uid() = requester_id OR auth.uid() = addressee_id);

-- User profiles policies
CREATE POLICY "Public profiles are viewable by everyone"
  ON user_profiles FOR SELECT
  USING (is_public = true OR auth.uid() = id);

CREATE POLICY "Users can view friends profiles"
  ON user_profiles FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM friendships
      WHERE status = 'accepted'
      AND ((requester_id = auth.uid() AND addressee_id = user_profiles.id)
           OR (addressee_id = auth.uid() AND requester_id = user_profiles.id))
    )
  );

CREATE POLICY "Users can insert their own profile"
  ON user_profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
  ON user_profiles FOR UPDATE
  USING (auth.uid() = id);

-- Shared tastings policies
CREATE POLICY "Users can view public tastings"
  ON shared_tastings FOR SELECT
  USING (visibility = 'public');

CREATE POLICY "Users can view friends tastings"
  ON shared_tastings FOR SELECT
  USING (
    visibility = 'friends' AND (
      user_id = auth.uid() OR
      EXISTS (
        SELECT 1 FROM friendships
        WHERE status = 'accepted'
        AND ((requester_id = auth.uid() AND addressee_id = shared_tastings.user_id)
             OR (addressee_id = auth.uid() AND requester_id = shared_tastings.user_id))
      )
    )
  );

CREATE POLICY "Users can share their own tastings"
  ON shared_tastings FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own shared tastings"
  ON shared_tastings FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own shared tastings"
  ON shared_tastings FOR DELETE
  USING (auth.uid() = user_id);

-- Likes policies
CREATE POLICY "Users can view likes on visible tastings"
  ON tasting_likes FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM shared_tastings st
      WHERE st.id = tasting_likes.shared_tasting_id
      AND (st.visibility = 'public' OR st.user_id = auth.uid() OR
           EXISTS (
             SELECT 1 FROM friendships
             WHERE status = 'accepted'
             AND ((requester_id = auth.uid() AND addressee_id = st.user_id)
                  OR (addressee_id = auth.uid() AND requester_id = st.user_id))
           ))
    )
  );

CREATE POLICY "Users can like tastings"
  ON tasting_likes FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can unlike tastings"
  ON tasting_likes FOR DELETE
  USING (auth.uid() = user_id);

-- Comments policies
CREATE POLICY "Users can view comments on visible tastings"
  ON tasting_comments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM shared_tastings st
      WHERE st.id = tasting_comments.shared_tasting_id
      AND (st.visibility = 'public' OR st.user_id = auth.uid() OR
           EXISTS (
             SELECT 1 FROM friendships
             WHERE status = 'accepted'
             AND ((requester_id = auth.uid() AND addressee_id = st.user_id)
                  OR (addressee_id = auth.uid() AND requester_id = st.user_id))
           ))
    )
  );

CREATE POLICY "Users can comment on visible tastings"
  ON tasting_comments FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own comments"
  ON tasting_comments FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own comments"
  ON tasting_comments FOR DELETE
  USING (auth.uid() = user_id);

-- Update triggers
CREATE TRIGGER update_friendships_updated_at
  BEFORE UPDATE ON friendships
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_profiles_updated_at
  BEFORE UPDATE ON user_profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_shared_tastings_updated_at
  BEFORE UPDATE ON shared_tastings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_tasting_comments_updated_at
  BEFORE UPDATE ON tasting_comments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
