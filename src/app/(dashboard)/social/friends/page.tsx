"use client";

import { useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  useFriendsWithProfiles,
  useFriendRequests,
  useSearchUsers,
  useSendFriendRequest,
  useRespondToFriendRequest,
  useRemoveFriend,
  useFriendships,
  useUserProfile,
  useUpdateUserProfile,
} from "@/lib/hooks/use-social";
import { useAuth } from "@/components/providers/auth-provider";
import { toast } from "sonner";
import type { UserProfile, Friendship } from "@/types/database";

function FriendCard({
  profile,
  friendship,
  onRemove,
}: {
  profile: UserProfile;
  friendship?: Friendship;
  onRemove: () => void;
}) {
  const initials = (profile.display_name || "??").substring(0, 2).toUpperCase();

  return (
    <div className="flex items-center justify-between p-3 rounded-lg border">
      <div className="flex items-center gap-3">
        <Avatar>
          <AvatarFallback className="bg-primary/10 text-primary">
            {initials}
          </AvatarFallback>
        </Avatar>
        <div>
          <p className="font-medium">{profile.display_name || "Wine Lover"}</p>
          {profile.bio && (
            <p className="text-xs text-muted-foreground line-clamp-1">
              {profile.bio}
            </p>
          )}
        </div>
      </div>
      <Button variant="ghost" size="sm" onClick={onRemove}>
        Remove
      </Button>
    </div>
  );
}

function FriendRequestCard({
  request,
  onAccept,
  onDecline,
}: {
  request: Friendship;
  onAccept: () => void;
  onDecline: () => void;
}) {
  const { data: requesterProfile } = useUserProfile(request.requester_id);
  const initials = (requesterProfile?.display_name || "??")
    .substring(0, 2)
    .toUpperCase();

  return (
    <div className="flex items-center justify-between p-3 rounded-lg border">
      <div className="flex items-center gap-3">
        <Avatar>
          <AvatarFallback className="bg-primary/10 text-primary">
            {initials}
          </AvatarFallback>
        </Avatar>
        <div>
          <p className="font-medium">
            {requesterProfile?.display_name || "Wine Lover"}
          </p>
          <p className="text-xs text-muted-foreground">Wants to be your friend</p>
        </div>
      </div>
      <div className="flex gap-2">
        <Button size="sm" onClick={onAccept}>
          Accept
        </Button>
        <Button variant="ghost" size="sm" onClick={onDecline}>
          Decline
        </Button>
      </div>
    </div>
  );
}

function SearchUserCard({
  profile,
  onAddFriend,
  isPending,
  alreadyFriend,
}: {
  profile: UserProfile;
  onAddFriend: () => void;
  isPending: boolean;
  alreadyFriend: boolean;
}) {
  const initials = (profile.display_name || "??").substring(0, 2).toUpperCase();

  return (
    <div className="flex items-center justify-between p-3 rounded-lg border">
      <div className="flex items-center gap-3">
        <Avatar>
          <AvatarFallback className="bg-primary/10 text-primary">
            {initials}
          </AvatarFallback>
        </Avatar>
        <div>
          <p className="font-medium">{profile.display_name || "Wine Lover"}</p>
          {profile.bio && (
            <p className="text-xs text-muted-foreground line-clamp-1">
              {profile.bio}
            </p>
          )}
        </div>
      </div>
      {alreadyFriend ? (
        <Badge variant="secondary">Friends</Badge>
      ) : (
        <Button size="sm" onClick={onAddFriend} disabled={isPending}>
          {isPending ? "Sending..." : "Add Friend"}
        </Button>
      )}
    </div>
  );
}

function ProfileSettings() {
  const { data: profile, isLoading } = useUserProfile();
  const updateProfile = useUpdateUserProfile();
  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [isPublic, setIsPublic] = useState(false);
  const [initialized, setInitialized] = useState(false);

  // Initialize form with profile data
  if (profile && !initialized) {
    setDisplayName(profile.display_name || "");
    setBio(profile.bio || "");
    setIsPublic(profile.is_public);
    setInitialized(true);
  }

  const handleSave = () => {
    updateProfile.mutate(
      {
        display_name: displayName.trim() || null,
        bio: bio.trim() || null,
        is_public: isPublic,
      },
      {
        onSuccess: () => toast.success("Profile updated"),
        onError: () => toast.error("Failed to update profile"),
      }
    );
  };

  if (isLoading) {
    return <p className="text-muted-foreground">Loading profile...</p>;
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <label className="text-sm font-medium">Display Name</label>
        <Input
          placeholder="Your display name"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
        />
        <p className="text-xs text-muted-foreground">
          This is how others will see you
        </p>
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium">Bio</label>
        <Input
          placeholder="A short bio about yourself"
          value={bio}
          onChange={(e) => setBio(e.target.value)}
        />
      </div>

      <div className="flex items-center gap-3">
        <input
          type="checkbox"
          id="isPublic"
          checked={isPublic}
          onChange={(e) => setIsPublic(e.target.checked)}
          className="rounded"
        />
        <label htmlFor="isPublic" className="text-sm">
          Make profile public (others can find you in search)
        </label>
      </div>

      <Button onClick={handleSave} disabled={updateProfile.isPending}>
        {updateProfile.isPending ? "Saving..." : "Save Profile"}
      </Button>
    </div>
  );
}

export default function FriendsPage() {
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");

  const { data: friends, isLoading: friendsLoading } = useFriendsWithProfiles();
  const { data: requests } = useFriendRequests();
  const { data: friendships } = useFriendships("accepted");
  const { data: searchResults } = useSearchUsers(searchQuery);

  const sendRequest = useSendFriendRequest();
  const respondToRequest = useRespondToFriendRequest();
  const removeFriend = useRemoveFriend();

  const handleSendRequest = (addresseeId: string) => {
    sendRequest.mutate(addresseeId, {
      onSuccess: () => toast.success("Friend request sent!"),
      onError: () => toast.error("Failed to send request"),
    });
  };

  const handleAccept = (friendshipId: string) => {
    respondToRequest.mutate(
      { friendshipId, status: "accepted" },
      {
        onSuccess: () => toast.success("Friend request accepted!"),
        onError: () => toast.error("Failed to accept request"),
      }
    );
  };

  const handleDecline = (friendshipId: string) => {
    respondToRequest.mutate(
      { friendshipId, status: "declined" },
      {
        onSuccess: () => toast.success("Friend request declined"),
        onError: () => toast.error("Failed to decline request"),
      }
    );
  };

  const handleRemoveFriend = (friendshipId: string) => {
    if (confirm("Are you sure you want to remove this friend?")) {
      removeFriend.mutate(friendshipId, {
        onSuccess: () => toast.success("Friend removed"),
        onError: () => toast.error("Failed to remove friend"),
      });
    }
  };

  // Get friendship ID for a friend
  const getFriendshipId = (friendId: string) => {
    const friendship = friendships?.find(
      (f) =>
        (f.requester_id === user?.id && f.addressee_id === friendId) ||
        (f.addressee_id === user?.id && f.requester_id === friendId)
    );
    return friendship?.id;
  };

  // Check if user is already a friend
  const isAlreadyFriend = (userId: string) => {
    return friends?.some((f) => f.id === userId) || false;
  };

  return (
    <div className="container py-6 space-y-6 max-w-2xl">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/social">← Back</Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold font-playfair">Friends</h1>
          <p className="text-sm text-muted-foreground">
            Manage your wine friends
          </p>
        </div>
      </div>

      <Tabs defaultValue="friends">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="friends">
            Friends {friends?.length ? `(${friends.length})` : ""}
          </TabsTrigger>
          <TabsTrigger value="requests">
            Requests
            {requests && requests.length > 0 && (
              <Badge variant="destructive" className="ml-1">
                {requests.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="search">Find</TabsTrigger>
          <TabsTrigger value="profile">Profile</TabsTrigger>
        </TabsList>

        <TabsContent value="friends" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Your Friends</CardTitle>
            </CardHeader>
            <CardContent>
              {friendsLoading ? (
                <p className="text-muted-foreground">Loading friends...</p>
              ) : friends && friends.length > 0 ? (
                <div className="space-y-2">
                  {friends.map((friend) => {
                    const friendshipId = getFriendshipId(friend.id);
                    return (
                      <FriendCard
                        key={friend.id}
                        profile={friend}
                        onRemove={() =>
                          friendshipId && handleRemoveFriend(friendshipId)
                        }
                      />
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-6">
                  <p className="text-muted-foreground mb-4">
                    You haven&apos;t added any friends yet
                  </p>
                  <Button
                    variant="outline"
                    onClick={() => {
                      const tab = document.querySelector('[data-state="inactive"][value="search"]');
                      if (tab) (tab as HTMLElement).click();
                    }}
                  >
                    Find Friends
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="requests" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Friend Requests</CardTitle>
            </CardHeader>
            <CardContent>
              {requests && requests.length > 0 ? (
                <div className="space-y-2">
                  {requests.map((request) => (
                    <FriendRequestCard
                      key={request.id}
                      request={request}
                      onAccept={() => handleAccept(request.id)}
                      onDecline={() => handleDecline(request.id)}
                    />
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground text-center py-6">
                  No pending friend requests
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="search" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Find Wine Lovers</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Input
                placeholder="Search by name..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Search for users with public profiles
              </p>

              {searchQuery.length >= 2 && (
                <div className="space-y-2">
                  {searchResults && searchResults.length > 0 ? (
                    searchResults.map((profile) => (
                      <SearchUserCard
                        key={profile.id}
                        profile={profile}
                        onAddFriend={() => handleSendRequest(profile.id)}
                        isPending={sendRequest.isPending}
                        alreadyFriend={isAlreadyFriend(profile.id)}
                      />
                    ))
                  ) : (
                    <p className="text-muted-foreground text-center py-4">
                      No users found
                    </p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="profile" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Your Profile</CardTitle>
            </CardHeader>
            <CardContent>
              <ProfileSettings />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
