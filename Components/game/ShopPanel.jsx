import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ShoppingBag, Star, Crown, Gem, Sparkles, Check } from 'lucide-react';

const SHOP_ITEMS = [
  { 
    id: 'vip', 
    name: 'VIP Status', 
    description: 'Get a shiny VIP badge and 2x click power!',
    price: 4.99,
    icon: Star,
    color: 'from-yellow-500 to-orange-500',
    type: 'vip',
    realMoney: true
  },
  { 
    id: 'bronze_membership', 
    name: 'Bronze Membership', 
    description: 'Upgrade to Bronze tier',
    price: 0.99,
    icon: Gem,
    color: 'from-amber-600 to-amber-800',
    type: 'membership',
    value: 'bronze',
    realMoney: true
  },
  { 
    id: 'silver_membership', 
    name: 'Silver Membership', 
    description: 'Upgrade to Silver tier',
    price: 2.99,
    icon: Gem,
    color: 'from-gray-300 to-gray-500',
    type: 'membership',
    value: 'silver',
    realMoney: true
  },
  { 
    id: 'gold_membership', 
    name: 'Gold Membership', 
    description: 'Upgrade to Gold tier',
    price: 9.99,
    icon: Crown,
    color: 'from-yellow-400 to-yellow-600',
    type: 'membership',
    value: 'gold',
    realMoney: true
  },
  { 
    id: 'diamond_membership', 
    name: 'Diamond Membership', 
    description: 'Upgrade to Diamond tier - Ultimate!',
    price: 19.99,
    icon: Gem,
    color: 'from-cyan-300 to-cyan-500',
    type: 'membership',
    value: 'diamond',
    realMoney: true
  },
];

export default function ShopPanel({ player, cookies, onPurchase, freeVipAvailable, freeBoosts }) {
  const [purchasing, setPurchasing] = useState(null);

  const formatNumber = (num) => {
    if (num >= 1e12) return (num / 1e12).toFixed(1) + 'T';
    if (num >= 1e9) return (num / 1e9).toFixed(1) + 'B';
    if (num >= 1e6) return (num / 1e6).toFixed(1) + 'M';
    if (num >= 1e3) return (num / 1e3).toFixed(1) + 'K';
    return Math.floor(num).toLocaleString();
  };

  const handlePurchase = async (item) => {
    if (item.realMoney) {
      // Simulate purchase (in real app would use payment gateway)
      if (!confirm(`Purchase ${item.name} for $${item.price}?`)) return;
    }
    setPurchasing(item.id);
    await onPurchase(item);
    setPurchasing(null);
  };

  

  const isOwned = (item) => {
    if (item.type === 'vip') return player.is_vip;
    if (item.type === 'membership') return player.membership === item.value;
    return false;
  };

  const membershipOrder = ['free', 'bronze', 'silver', 'gold', 'diamond'];
  const canBuyMembership = (item) => {
    if (item.type !== 'membership') return true;
    const currentIndex = membershipOrder.indexOf(player.membership || 'free');
    const itemIndex = membershipOrder.indexOf(item.value);
    return itemIndex > currentIndex;
  };

  return (
    <Card className="bg-gradient-to-br from-amber-950/80 to-amber-900/60 border-amber-700/50">
      <CardHeader className="pb-3">
        <CardTitle className="text-amber-300 flex items-center gap-2">
          <ShoppingBag className="w-5 h-5" /> Premium Shop
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 max-h-[500px] overflow-y-auto">
        {/* Free Boost Banners */}
        {freeBoosts?.map((boost) => {
          const boostType = boost.name?.toLowerCase();
          const isVip = boostType?.includes('vip');
          const isBronze = boostType?.includes('bronze');
          const isSilver = boostType?.includes('silver');
          const isGold = boostType?.includes('gold');
          const isDiamond = boostType?.includes('diamond');
          
          const alreadyHas = (isVip && player.is_vip) || 
            (isBronze && player.membership === 'bronze') ||
            (isSilver && player.membership === 'silver') ||
            (isGold && player.membership === 'gold') ||
            (isDiamond && player.membership === 'diamond');
          
          if (alreadyHas) return null;
          
          return (
            <div key={boost.id} className="bg-gradient-to-r from-purple-600 to-pink-600 rounded-lg p-4 mb-2 animate-pulse">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-6 h-6 text-yellow-300" />
                  <div>
                    <p className="text-white font-bold">FREE {boost.name}!</p>
                    <p className="text-white/80 text-xs">Limited time boost active</p>
                  </div>
                </div>
                <Button 
                  onClick={async () => {
                    setPurchasing('free_' + boost.id);
                    const updates = {};
                    if (isVip) updates.is_vip = true;
                    if (isBronze) updates.membership = 'bronze';
                    if (isSilver) updates.membership = 'silver';
                    if (isGold) updates.membership = 'gold';
                    if (isDiamond) updates.membership = 'diamond';
                    await onPurchase({ ...updates, type: isVip ? 'vip' : 'membership', value: updates.membership, price: 0 });
                    setPurchasing(null);
                  }}
                  disabled={purchasing === 'free_' + boost.id}
                  className="bg-yellow-500 hover:bg-yellow-600 text-black font-bold"
                >
                  {purchasing === 'free_' + boost.id ? 'Claiming...' : 'Claim FREE!'}
                </Button>
              </div>
            </div>
          );
        })}

        {SHOP_ITEMS.map((item) => {
          const Icon = item.icon;
          const owned = isOwned(item);
          const canBuy = canBuyMembership(item);
          const canAfford = cookies >= item.price;

          return (
            <div
              key={item.id}
              className={`p-3 rounded-lg border ${
                owned 
                  ? 'bg-green-900/30 border-green-600/50' 
                  : canAfford && canBuy
                    ? 'bg-amber-900/30 border-amber-600/50'
                    : 'bg-gray-900/30 border-gray-700/50 opacity-60'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg bg-gradient-to-br ${item.color}`}>
                  <Icon className="w-5 h-5 text-white" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-white font-medium">{item.name}</span>
                    {owned && (
                      <Badge className="bg-green-600 text-white text-xs">
                        <Check className="w-3 h-3 mr-1" /> Owned
                      </Badge>
                    )}
                  </div>
                  <p className="text-gray-400 text-xs">{item.description}</p>
                </div>
                <div className="text-right">
                  {!owned && (
                    <>
                      <p className={`font-bold ${item.realMoney ? 'text-green-400' : (canAfford ? 'text-green-400' : 'text-red-400')}`}>
                        {item.realMoney ? `$${item.price}` : `🍪 ${formatNumber(item.price)}`}
                      </p>
                      <Button
                        size="sm"
                        onClick={() => handlePurchase(item)}
                        disabled={(!item.realMoney && !canAfford) || !canBuy || purchasing === item.id}
                        className="mt-1 bg-amber-600 hover:bg-amber-700 text-xs"
                      >
                        {purchasing === item.id ? '...' : 'Buy'}
                      </Button>
                    </>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}