/// <reference types="astro/client" />

declare namespace App {
  interface Locals {
    /** Set by src/middleware.ts from the URL prefix. */
    lang: 'en' | 'sv';
  }
}
