// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Ben Richardson <hi@ben.gy>
export interface ViewContext {
  openCountry: (code: string) => void;
  goTo: (id: string) => void;
  getState: (key: string, fallback: string) => string;
  setState: (key: string, value: string) => void;
  onTeardown: (fn: () => void) => void;
  readonly signal: AbortSignal;
}
