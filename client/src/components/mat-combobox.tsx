import { useState } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useQuery } from "@tanstack/react-query";

interface Supply {
  sku: string;
  name: string;
  size: string;
  price: number;
}

interface MatComboboxProps {
  value?: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
}

export function MatCombobox({ value, onChange, placeholder = "Select mat...", disabled }: MatComboboxProps) {
  const [open, setOpen] = useState(false);
  const [searchValue, setSearchValue] = useState("");

  const { data: supplies = [] } = useQuery<Supply[]>({
    queryKey: ["/api/supplies"],
  });

  const selectedSupply = supplies.find((supply) => supply.sku === value);

  // Filter supplies based on search - search both SKU and name
  const filteredSupplies = supplies.filter((supply) => {
    const search = searchValue.toLowerCase();
    return (
      supply.sku.toString().toLowerCase().includes(search) ||
      supply.name.toLowerCase().includes(search)
    );
  }).slice(0, 100); // Limit to 100 results for performance

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between font-normal"
          disabled={disabled}
        >
          {selectedSupply ? (
            <span className="truncate">
              <span className="font-mono">{selectedSupply.sku}</span> - {selectedSupply.name}
            </span>
          ) : (
            <span className="text-muted-foreground">{placeholder}</span>
          )}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[400px] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput 
            placeholder="Search by SKU or name..." 
            value={searchValue}
            onValueChange={setSearchValue}
          />
          <CommandList>
            <CommandEmpty>No supply found.</CommandEmpty>
            <CommandGroup>
              {filteredSupplies.map((supply) => (
                <CommandItem
                  key={supply.sku}
                  value={supply.sku}
                  onSelect={() => {
                    onChange(supply.sku === value ? "" : supply.sku);
                    setOpen(false);
                    setSearchValue("");
                  }}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      value === supply.sku ? "opacity-100" : "opacity-0"
                    )}
                  />
                  <div className="flex flex-col gap-1 flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm font-medium">{supply.sku}</span>
                      <span className="text-xs text-muted-foreground font-mono">${supply.price.toFixed(2)}</span>
                    </div>
                    <span className="text-xs text-muted-foreground truncate">{supply.name}</span>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
