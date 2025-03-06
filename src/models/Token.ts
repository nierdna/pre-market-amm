export class Token {
  private _name: string;
  private _symbol: string;
  private _decimals: number;
  private _totalSupply: number;
  private _balances: Map<string, number>;

  constructor(name: string, symbol: string, decimals: number = 18) {
    this._name = name;
    this._symbol = symbol;
    this._decimals = decimals;
    this._totalSupply = 0;
    this._balances = new Map<string, number>();
  }

  get name(): string {
    return this._name;
  }

  get symbol(): string {
    return this._symbol;
  }

  get decimals(): number {
    return this._decimals;
  }

  get totalSupply(): number {
    return this._totalSupply;
  }

  balanceOf(account: string): number {
    return this._balances.get(account) || 0;
  }

  mint(to: string, amount: number): boolean {
    if (amount <= 0) return false;

    const currentBalance = this.balanceOf(to);
    this._balances.set(to, currentBalance + amount);
    this._totalSupply += amount;

    console.log(`Minted ${amount} ${this._symbol} to ${to}`);
    return true;
  }

  burn(from: string, amount: number): boolean {
    const currentBalance = this.balanceOf(from);
    if (amount <= 0 || currentBalance < amount) return false;

    this._balances.set(from, currentBalance - amount);
    this._totalSupply -= amount;

    console.log(`Burned ${amount} ${this._symbol} from ${from}`);
    return true;
  }

  transfer(from: string, to: string, amount: number): boolean {
    const fromBalance = this.balanceOf(from);
    if (amount <= 0 || fromBalance < amount) return false;

    this._balances.set(from, fromBalance - amount);
    this._balances.set(to, this.balanceOf(to) + amount);

    console.log(`Transferred ${amount} ${this._symbol} from ${from} to ${to}`);
    return true;
  }
}
