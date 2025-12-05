import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { createPageUrl } from '@/utils';
import { LogOut, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

import CookieButton from '@/components/game/CookieButton';
import StatsDisplay from '@/components/game/StatsDisplay';
import UpgradeShop, { UPGRADES } from '@/components/game/UpgradeShop';
import ClanPanel from '@/components/game/ClanPanel';
import BoostBanner from '@/components/game/BoostBanner';
import AdminPanel from '@/components/admin/AdminPanel';
import ProfilePanel from '@/components/game/ProfilePanel';
import LeaguePanel from '@/components/game/LeaguePanel';
import ShopPanel from '@/components/game/ShopPanel';
import FriendsPanel from '@/components/game/FriendsPanel';

export default function Game() {
  const queryClient = useQueryClient();
  const [player, setPlayer] = useState(null);
  const [cookies, setCookies] = useState(0);
  const [clickEffects, setClickEffects] = useState([]);
  const [currentClan, setCurrentClan] = useState(null);
  
  // Load player from localStorage
  useEffect(() => {
    const savedPlayer = localStorage.getItem('cookiePlayer');
    if (!savedPlayer) {
      window.location.href = createPageUrl('Home');
      return;
    }
    const parsed = JSON.parse(savedPlayer);
    setPlayer(parsed);
    setCookies(parsed.cookies || 0);
  }, []);
  
  // Fetch fresh player data
  const { data: freshPlayer } = useQuery({
    queryKey: ['player', player?.id],
    queryFn: async () => {
      if (!player?.id) return null;
      const players = await base44.entities.Player.filter({ id: player.id });
      return players[0] || null;
    },
    enabled: !!player?.id,
    refetchInterval: 5000
  });
  
  useEffect(() => {
    if (freshPlayer) {
      // Check for locally saved data (in case of page reload)
      const localData = localStorage.getItem('cookiePlayerData_' + freshPlayer.id);
      if (localData) {
        const parsed = JSON.parse(localData);
        // Use local cookies if higher (to not lose progress)
        if (parsed.cookies > freshPlayer.cookies) {
          setCookies(parsed.cookies);
          base44.entities.Player.update(freshPlayer.id, { cookies: parsed.cookies });
        }
        localStorage.removeItem('cookiePlayerData_' + freshPlayer.id);
      }
      setPlayer(freshPlayer);
      localStorage.setItem('cookiePlayer', JSON.stringify(freshPlayer));
    }
  }, [freshPlayer]);
  
  // Fetch clans
  const { data: clans = [] } = useQuery({
    queryKey: ['clans'],
    queryFn: () => base44.entities.Clan.list(),
  });
  
  // Fetch current clan
  useEffect(() => {
    if (player?.clan_id && clans.length > 0) {
      const clan = clans.find(c => c.id === player.clan_id);
      setCurrentClan(clan);
    } else {
      setCurrentClan(null);
    }
  }, [player?.clan_id, clans]);
  
  // Fetch global boosts
  const { data: boosts = [], refetch: refetchBoosts } = useQuery({
    queryKey: ['boosts'],
    queryFn: () => base44.entities.GlobalBoost.filter({ is_active: true }),
    refetchInterval: 10000
  });
  
  // Calculate active boosts
  const activeBoosts = boosts.filter(b => new Date(b.expires_at) > new Date());
  
  const getClickMultiplier = () => {
    return activeBoosts
      .filter(b => b.type === 'click_multiplier')
      .reduce((mult, b) => mult * b.multiplier, 1);
  };
  
  const getCPSMultiplier = () => {
    return activeBoosts
      .filter(b => b.type === 'cps_multiplier')
      .reduce((mult, b) => mult * b.multiplier, 1);
  };
  
  const getBonusCookies = () => {
    return activeBoosts
      .filter(b => b.type === 'bonus_cookies')
      .reduce((sum, b) => sum + b.multiplier, 0);
  };
  
  // Calculate CPC and CPS from upgrades
  const calculateStats = useCallback(() => {
    let cpc = 1;
    let cps = 0;
    
    UPGRADES.forEach(upgrade => {
      const count = player?.upgrades?.[upgrade.id] || 0;
      cpc += upgrade.cpcBonus * count;
      cps += upgrade.cpsBonus * count;
    });
    
    return { cpc, cps };
  }, [player?.upgrades]);
  
  const { cpc: baseCpc, cps: baseCps } = calculateStats();
  const effectiveCpc = Math.floor(baseCpc * getClickMultiplier() + getBonusCookies());
  const effectiveCps = Math.floor(baseCps * getCPSMultiplier());
  
  // Auto-save cookies periodically
  useEffect(() => {
    if (!player?.id) return;
    
    const saveInterval = setInterval(async () => {
      await base44.entities.Player.update(player.id, { 
        cookies: cookies,
        cookies_per_click: effectiveCpc,
        cookies_per_second: effectiveCps
      });
    }, 3000);
    
    return () => clearInterval(saveInterval);
  }, [player?.id, cookies, effectiveCpc, effectiveCps]);
  
  // Save on page unload
  useEffect(() => {
    if (!player?.id) return;
    
    const handleBeforeUnload = () => {
      const data = JSON.stringify({
        cookies,
        upgrades: player.upgrades,
        cookies_per_click: effectiveCpc,
        cookies_per_second: effectiveCps
      });
      localStorage.setItem('cookiePlayerData_' + player.id, data);
    };
    
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [player?.id, cookies, player?.upgrades, effectiveCpc, effectiveCps]);
  
  // Cookies per second
  useEffect(() => {
    if (effectiveCps <= 0) return;
    
    const interval = setInterval(() => {
      setCookies(prev => prev + effectiveCps);
    }, 1000);
    
    return () => clearInterval(interval);
  }, [effectiveCps]);
  
  // Click handler
  const handleClick = (e) => {
    const earned = effectiveCpc;
    setCookies(prev => prev + earned);
    
    // Add click effect
    const id = Date.now();
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    setClickEffects(prev => [...prev, { id, x, y, value: earned }]);
    
    setTimeout(() => {
      setClickEffects(prev => prev.filter(effect => effect.id !== id));
    }, 1000);
  };
  
  // Purchase upgrade
  const handlePurchase = async (upgrade, cost) => {
    if (cookies < cost) return;
    
    setCookies(prev => prev - cost);
    const newUpgrades = {
      ...player.upgrades,
      [upgrade.id]: (player.upgrades?.[upgrade.id] || 0) + 1
    };
    
    await base44.entities.Player.update(player.id, { upgrades: newUpgrades });
    setPlayer(prev => ({ ...prev, upgrades: newUpgrades }));
    localStorage.setItem('cookiePlayer', JSON.stringify({ ...player, upgrades: newUpgrades }));
  };
  
  // Clan functions
  const handleCreateClan = async (clanData) => {
    const clan = await base44.entities.Clan.create({
      ...clanData,
      leader_username: player.username,
      member_count: 1,
      total_cookies: cookies
    });
    
    await base44.entities.Player.update(player.id, { clan_id: clan.id });
    setPlayer(prev => ({ ...prev, clan_id: clan.id }));
    localStorage.setItem('cookiePlayer', JSON.stringify({ ...player, clan_id: clan.id }));
    queryClient.invalidateQueries({ queryKey: ['clans'] });
  };
  
  const handleJoinClan = async (clan) => {
    await base44.entities.Clan.update(clan.id, { 
      member_count: (clan.member_count || 1) + 1 
    });
    await base44.entities.Player.update(player.id, { clan_id: clan.id });
    setPlayer(prev => ({ ...prev, clan_id: clan.id }));
    localStorage.setItem('cookiePlayer', JSON.stringify({ ...player, clan_id: clan.id }));
    queryClient.invalidateQueries({ queryKey: ['clans'] });
  };
  
  const handleLeaveClan = async () => {
    if (currentClan) {
      await base44.entities.Clan.update(currentClan.id, { 
        member_count: Math.max(0, (currentClan.member_count || 1) - 1) 
      });
    }
    await base44.entities.Player.update(player.id, { clan_id: null });
    setPlayer(prev => ({ ...prev, clan_id: null }));
    localStorage.setItem('cookiePlayer', JSON.stringify({ ...player, clan_id: null }));
    queryClient.invalidateQueries({ queryKey: ['clans'] });
  };
  
  const handleLogout = () => {
    localStorage.removeItem('cookiePlayer');
    window.location.href = createPageUrl('Home');
  };
  
  if (!player) return null;
  
  const hasActiveBoosts = activeBoosts.length > 0;
  
  return (
    <div className={`min-h-screen bg-gradient-to-br from-amber-950 via-amber-900 to-yellow-900 ${hasActiveBoosts ? 'pt-20' : ''}`}>
      {/* Boost Banner */}
      <BoostBanner boosts={activeBoosts} />
      
      {/* Header */}
      <div className="absolute top-2 right-2 z-40 flex items-center gap-2">
        <span className="text-amber-300 font-medium bg-amber-950/80 px-3 py-1 rounded-full">
          {player.username}
          {player.is_admin && <span className="ml-2 text-purple-400">👑</span>}
        </span>
        <Button
          variant="ghost"
          size="icon"
          onClick={handleLogout}
          className="text-amber-400 hover:text-amber-300 hover:bg-amber-900/50"
        >
          <LogOut className="w-5 h-5" />
        </Button>
      </div>
      
      <div className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Game Area */}
          <div className="lg:col-span-2 flex flex-col items-center justify-center min-h-[60vh] relative">
            {/* Stats */}
            <StatsDisplay 
              cookies={cookies} 
              cps={effectiveCps} 
              cpc={effectiveCpc}
              clan={currentClan}
            />
            
            {/* Cookie Button */}
            <div className="my-8 relative">
              <CookieButton onClick={handleClick} cookiesPerClick={effectiveCpc} />
              
              {/* Click effects */}
              <AnimatePresence>
                {clickEffects.map(effect => (
                  <motion.div
                    key={effect.id}
                    initial={{ opacity: 1, y: 0, scale: 1 }}
                    animate={{ opacity: 0, y: -100, scale: 1.5 }}
                    exit={{ opacity: 0 }}
                    className="absolute pointer-events-none text-amber-300 font-bold text-2xl"
                    style={{ left: effect.x, top: effect.y }}
                  >
                    +{effect.value}
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          </div>
          
          {/* Side Panel */}
          <div className="space-y-6">
            <Tabs defaultValue="upgrades" className="w-full">
              <TabsList className="w-full bg-amber-950/50">
                <TabsTrigger value="upgrades" className="flex-1">Upgrades</TabsTrigger>
                <TabsTrigger value="clans" className="flex-1">Clans</TabsTrigger>
                <TabsTrigger value="profile" className="flex-1">Profile</TabsTrigger>
                <TabsTrigger value="league" className="flex-1">League</TabsTrigger>
                <TabsTrigger value="shop" className="flex-1">Shop</TabsTrigger>
                <TabsTrigger value="friends" className="flex-1">Friends</TabsTrigger>
                {player.is_admin && (
                  <TabsTrigger value="admin" className="flex-1 text-purple-400">Admin</TabsTrigger>
                )}
              </TabsList>
              
              <TabsContent value="upgrades" className="mt-4">
                <UpgradeShop 
                  cookies={cookies} 
                  upgrades={player.upgrades || {}}
                  onPurchase={handlePurchase}
                />
              </TabsContent>
              
              <TabsContent value="clans" className="mt-4">
                <ClanPanel
                  player={player}
                  clans={clans}
                  currentClan={currentClan}
                  onCreateClan={handleCreateClan}
                  onJoinClan={handleJoinClan}
                  onLeaveClan={handleLeaveClan}
                />
              </TabsContent>
              
              <TabsContent value="profile" className="mt-4">
                <ProfilePanel 
                  player={{...player, cookies, cookies_per_second: effectiveCps}} 
                  clan={currentClan} 
                  onPlayerUpdate={(updated) => {
                    setPlayer(updated);
                    localStorage.setItem('cookiePlayer', JSON.stringify(updated));
                  }}
                />
              </TabsContent>
              
              <TabsContent value="league" className="mt-4">
                <LeaguePanel clans={clans} currentClan={currentClan} />
              </TabsContent>
              
              <TabsContent value="shop" className="mt-4">
                <ShopPanel 
                  player={player}
                  cookies={cookies}
                  freeBoosts={activeBoosts.filter(b => b.name?.toLowerCase().includes('free'))}
                  onPurchase={async (item) => {
                    const updates = {};
                    if (item.type === 'vip') {
                      updates.is_vip = true;
                    } else if (item.type === 'membership') {
                      updates.membership = item.value;
                    }
                    await base44.entities.Player.update(player.id, updates);
                    setPlayer(prev => ({ ...prev, ...updates }));
                    localStorage.setItem('cookiePlayer', JSON.stringify({ ...player, ...updates }));
                  }}
                />
              </TabsContent>
              
              <TabsContent value="friends" className="mt-4">
                <FriendsPanel 
                  player={player}
                  cookies={cookies}
                  onCookiesChange={(amount) => setCookies(prev => prev + amount)}
                />
              </TabsContent>
              
              {player.is_admin && (
                <TabsContent value="admin" className="mt-4">
                  <AdminPanel 
                    boosts={boosts}
                    onBoostCreated={refetchBoosts}
                    onBoostDeleted={refetchBoosts}
                  />
                </TabsContent>
              )}
            </Tabs>
          </div>
        </div>
      </div>
    </div>
  );
}
