"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatRut } from "@/lib/utils";

export type CustomerRow = {
  id: string;
  rut: string;
  name: string;
  stampCount: number;
  rewardAt: number;
  isActive: boolean;
  lastPurchaseAt: string | null;
};

type CustomerTableProps = {
  customers: CustomerRow[];
  total: number;
  page: number;
  limit: number;
  status: string;
  onStatusChange: (status: string) => void;
  onQueryChange: (query: string) => void;
  onPageChange: (page: number) => void;
  onToggleStatus: (id: string, isActive: boolean) => Promise<void>;
  onRowClick?: (id: string) => void;
  loading?: boolean;
};

export function CustomerTable({
  customers,
  total,
  page,
  limit,
  status,
  onStatusChange,
  onQueryChange,
  onPageChange,
  onToggleStatus,
  onRowClick,
  loading,
}: CustomerTableProps) {
  const [query, setQuery] = useState("");
  const totalPages = Math.max(1, Math.ceil(total / limit));

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <Input
          placeholder="Buscar por nombre o RUT..."
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            onQueryChange(e.target.value);
          }}
          className="sm:max-w-xs"
        />
        <Select value={status} onValueChange={onStatusChange}>
          <SelectTrigger className="w-full sm:w-[180px]">
            <SelectValue placeholder="Estado" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="active">Activos</SelectItem>
            <SelectItem value="inactive">Desactivados</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-xl border bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>RUT</TableHead>
              <TableHead>Nombre</TableHead>
              <TableHead>Sellos</TableHead>
              <TableHead>Última compra</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="text-right">Acción</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {customers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                  {loading ? "Cargando..." : "Sin clientes"}
                </TableCell>
              </TableRow>
            ) : (
              customers.map((customer) => (
                <TableRow
                  key={customer.id}
                  className={onRowClick ? "cursor-pointer hover:bg-muted/40" : ""}
                  onClick={onRowClick ? () => onRowClick(customer.id) : undefined}
                >
                  <TableCell className="font-mono text-sm">{formatRut(customer.rut)}</TableCell>
                  <TableCell className="font-medium">{customer.name}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">
                        {customer.stampCount}/{customer.rewardAt}
                      </span>
                      <div className="h-1.5 w-16 overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full rounded-full bg-gold"
                          style={{
                            width: `${(customer.stampCount / customer.rewardAt) * 100}%`,
                          }}
                        />
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {customer.lastPurchaseAt
                      ? new Date(customer.lastPurchaseAt).toLocaleString("es-CL")
                      : "—"}
                  </TableCell>
                  <TableCell>
                    <Badge variant={customer.isActive ? "success" : "muted"}>
                      {customer.isActive ? "Activo" : "Desactivado"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        onToggleStatus(customer.id, !customer.isActive);
                      }}
                    >
                      {customer.isActive ? "Desactivar" : "Reactivar"}
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {total} cliente{total !== 1 ? "s" : ""}
        </p>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => onPageChange(page - 1)}
          >
            Anterior
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages}
            onClick={() => onPageChange(page + 1)}
          >
            Siguiente
          </Button>
        </div>
      </div>
    </div>
  );
}
