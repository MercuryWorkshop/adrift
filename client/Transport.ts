export default abstract class Transport {
  public ondata: (data: ArrayBuffer) => void = () => { }
  constructor(
    public onopen: () => void,
    public onclose: () => void
  ) { }

  abstract send(data: ArrayBuffer): void;
  abstract send(data: ArrayBuffer): void;
}
