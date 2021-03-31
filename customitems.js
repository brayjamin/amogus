const primatus = require('primatus');
const { core, mantle } = require('@grakkit/server');
const ItemStack = core.type('org.bukkit.inventory.ItemStack');
const ItemFlag = core.type('org.bukkit.inventory.ItemFlag');
const Material = core.type('org.bukkit.Material');
const Enchantment = core.type('org.bukkit.enchantments.Enchantment');

const NamespacedKey = core.type('org.bukkit.NamespacedKey');
const PersistentDataType = core.type('org.bukkit.persistence.PersistentDataType');
const PersistentDataContainer = core.type('org.bukkit.persistence.PersistentDataContainer');

const items = {
   'skyblock:cracked_magma_block': {
      type: Material.MAGMA_BLOCK,
      name: '§fCracked Magma Block',
      lore: [ '§7its cracked lol' ]
   }
};
primatus.export(module, {
   directives: {
      blockUpdates () {
         core.event('org.bukkit.event.block.BlockBurnEvent', (event) => {
            if (mantle.data(event.getBlock()).data) {
               delete mantle.data(event.getBlock()).data;
            }
         });
         // cool stuff in future with this???
         core.event('org.bukkit.event.block.BlockFadeEvent', (event) => {
            if (mantle.data(event.getBlock()).data) {
               delete mantle.data(event.getBlock()).data;
            }
         });
         core.event('org.bukkit.event.block.BlockFromToEvent', (event) => {
            if (mantle.data(event.getBlock().data)) {
               mantle.data(event.getBlock()).data.Location = mantle.serialize(event.getToBlock().getLocation());
            }
         });
         core.event('org.bukkit.event.block.BlockPistonExtendEvent', (event) => {
            // Iterate through Blocks that will be moved
            for (const block of event.getBlocks()) {
               // Check if block is custom
               if (mantle.data(block).data) {
                  const data = {
                     ItemStack: mantle.data(block).data.ItemStack,
                     Location: mantle.serialize(block.getRelative(event.getDirection()).getLocation())
                  };
                  mantle.data(block.getRelative(event.getDirection())).data = data;
                  delete mantle.data(block).data;
               }
            }
         });
         core.event('org.bukkit.event.block.BlockPistonRetractEvent', (event) => {
            for (const block of event.getBlocks()) {
               if (mantle.data(block).data) {
                  const data = {
                     ItemStack: mantle.serialize(mantle.data(block).ItemStack),
                     Location: mantle.serialize(block.getRelative(event.getDirection()).getLocation())
                  };
                  mantle.data(block.getRelative(event.getDirection())).data = data;
                  delete mantle.data(block).data;
               }
            }
         });
         core.event('org.bukkit.event.block.BlockPlaceEvent', (event) => {
            const player = event.getPlayer();
            const block = event.getBlock();
            let item = {};
            // Get ItemStack of hand that placed item
            if (event.getHand().toString() === 'HAND') {
               item = new ItemStack(player.getInventory().getItemInMainHand());
            } else {
               item = new ItemStack(player.getInventory().getItemInOffHand());
            }
            // Check if item contains the data tag 'custom'
            if (item.getItemMeta().getPersistentDataContainer().getRaw().toString().includes('custom')) {
               // Write data to DB
               const data = {
                  ItemStack: mantle.serialize(item),
                  Location: mantle.serialize(block.getLocation())
               };
               mantle.data(block).data = data;
            } // Else the block isn't registered in DB because it doesn't have custom data attributed to it.
         });
         core.event('org.bukkit.event.block.BlockBreakEvent', (event) => {
            const player = event.getPlayer();
            const block = event.getBlock();
            // Check if Block is registered in DB
            let custom = true;
            if (mantle.data(block).data) {
               // This check is here to ensure the location of the block location is equal to the location registered in the database (we probably don't need this)
               if (block.getLocation().equals(mantle.location(mantle.data(block).data.Location))) {
                  // Give ItemStack attributed to Block in DB
                  const item = mantle.itemStack(mantle.data(block).data.ItemStack);
                  let drop = item;
                  drop.setAmount(1);
                  // Cancel DropItem event and drop ItemStack attributed to Block
                  event.setDropItems(false);
                  block.getWorld().dropItemNaturally(event.getBlock().getLocation(), drop);
                  delete mantle.data(block).data;
               } else custom = false;
            } else custom = false;
            if (custom === false) {
               switch (block.getType()) {
                  // Cracked Magma Block
                  case Material.MAGMA_BLOCK: {
                     // Make sure player is in survival (so we don't mess stuff up when trying to build in creative!)
                     if (player.getGameMode().toString() === 'SURVIVAL') {
                        // Check if player has a Wooden or Stone Pickaxe (it's weaker so it "cracks" the block)
                        if (
                           player.getItemInHand().getType().toString() == 'STONE_PICKAXE' ||
                           player.getItemInHand().getType().toString() == 'WOODEN_PICKAXE'
                        ) {
                           // Instantialize custom item
                           const item = mantle.item(items['skyblock:cracked_magma_block']);
                           // Add Item "glow"
                           item.addUnsafeEnchantment(Enchantment.LURE, 1);
                           const meta = item.getItemMeta();
                           // Hide Item enchantments in lore
                           meta.addItemFlags(ItemFlag.HIDE_ENCHANTS);
                           // Add the 'custom' data flag to the Item under key 'grakkit'
                           meta
                              .getPersistentDataContainer()
                              .set(new NamespacedKey(core.plugin, 'itemNS'), PersistentDataType.STRING, 'custom');
                           // Apply metadata to Item
                           item.setItemMeta(meta);
                           // Cancel item drop
                           event.setDropItems(false);
                           // Drop Item at location of cancelled event
                           block.getWorld().dropItemNaturally(block.getLocation(), item);
                        }
                     }
                  }
               }
            }
         });
      },
      itemCrafting () {
         core.event('org.bukkit.event.inventory.PrepareItemCraftEvent', (event) => {
            const recipe = event.getRecipe();
            if (recipe) {
               const key = recipe.getKey().toString();
               const item = items.items[`${key}`];
               const inventory = event.getInventory();
               if (item) {
                  inventory.setResult(mantle.item(item));
               } else {
                  if (key.endsWith('_stairs')) {
                     const result = inventory.getResult();
                     result.setAmount(8);
                     inventory.setResult(result);
                  }
               }
            }
         });
      }
   },
   scope: { items }
});
