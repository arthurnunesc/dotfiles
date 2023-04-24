local lazypath = vim.fn.stdpath("data") .. "/lazy/lazy.nvim"
if not vim.loop.fs_stat(lazypath) then
  vim.fn.system({
    "git",
    "clone",
    "--filter=blob:none",
    "https://github.com/folke/lazy.nvim.git",
    "--branch=stable", -- latest stable release
    lazypath,
  })
end
vim.opt.rtp:prepend(lazypath)

local plugins = {
  -- Theming
  { "https://github.com/aonemd/quietlight.vim.git" , name = "quietlight" },
  { 'rose-pine/neovim', name = 'rose-pine' },
  { "catppuccin/nvim", name = "catppuccin" },
  -- LSP/DAP stuff
  { "neovim/nvim-lspconfig" },
  { "williamboman/mason.nvim", build = ":MasonUpdate" },
  { "williamboman/mason-lspconfig.nvim" },
  { "mfussenegger/nvim-dap" },
  { "jose-elias-alvarez/null-ls.nvim", dependencies = "nvim-lua/plenary.nvim" }, 
  { "nvim-treesitter/nvim-treesitter", build = ":TSUpdate" },
  -- { "nvim-treesitter/playground", build = ":TSInstall query" },
  -- Navigation
  { "nvim-telescope/telescope.nvim", version = "0.1.1", dependencies = "nvim-lua/plenary.nvim"},
  -- Code completion/AI
  { "github/copilot.vim" },
  -- 42 stuff
  { 'hardyrafael17/norminette42.nvim' },
}

require("lazy").setup(plugins, opts) 
