import { createRouter, createWebHistory } from 'vue-router'
import HomeView from '../views/HomeView.vue'
import Game2048View from '../views/Game2048View.vue'
import BlackjackView from '../views/BlackjackView.vue'
import SolitaireView from '../views/SolitaireView.vue'
import MahjongView from '../views/MahjongView.vue'
import TetrisView from '../views/TetrisView.vue'
import DinoView from '../views/DinoView.vue'
import SlotView from '../views/SlotView.vue'
import MinesweeperView from '../views/MinesweeperView.vue'
import PathZipView from '../views/PathZipView.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'home',
      component: HomeView,
    },
    {
      path: '/2048',
      name: '2048',
      component: Game2048View,
    },
    {
      path: '/blackjack',
      name: 'blackjack',
      component: BlackjackView,
    },
    {
      path: '/solitaire',
      name: 'solitaire',
      component: SolitaireView,
    },
    {
      path: '/mahjong',
      name: 'mahjong',
      component: MahjongView,
    },
    {
      path: '/tetris',
      name: 'tetris',
      component: TetrisView,
    },
    {
      path: '/dino',
      name: 'dino',
      component: DinoView,
    },
    {
      path: '/slot',
      name: 'slot',
      component: SlotView,
    },
    {
      path: '/minesweeper',
      name: 'minesweeper',
      component: MinesweeperView,
    },
    {
      path: '/pathzip',
      name: 'pathzip',
      component: PathZipView,
    },
    {
      path: '/:pathMatch(.*)*',
      redirect: '/',
    },
  ],
  scrollBehavior: () => ({ top: 0 }),
})

export default router
