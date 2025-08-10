namespace my;

@Core.OptimisticConcurrency : ['modifiedAt']
entity SalesOrders {
  key ID         : UUID;
      customerID : String(20);
      status     : String(10);          // NEW | OPEN | CLOSED | CANCELED
      total      : Decimal(15,2);
      modifiedAt : Timestamp;           // updated by CAP on each write
  items : Composition of many SalesItems on items.salesOrder = $self;
}

entity SalesItems {
  key ID         : UUID;
      productID  : String(20);
      quantity   : Integer;
      price      : Decimal(15,2);
      salesOrder : Association to SalesOrders;
}
service SalesService {
  entity SalesOrders as projection on my.SalesOrders;
  entity SalesItems  as projection on my.SalesItems;
}
