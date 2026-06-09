<template>
  <header class="navbar">
    <div class="navbar__inner">
      <RouterLink class="brand" to="/" aria-label="Mini Game Paradise home">
        <span class="brand__mark" aria-hidden="true">
          <span></span><span></span><span></span><span></span>
        </span>
        <span>Mini Game <strong>Paradise</strong></span>
      </RouterLink>

      <nav aria-label="Primary navigation">
        <RouterLink class="nav-link" to="/">
          <span class="nav-link__icon" aria-hidden="true">⌂</span>
          Home
        </RouterLink>
      </nav>
    </div>
  </header>
</template>
